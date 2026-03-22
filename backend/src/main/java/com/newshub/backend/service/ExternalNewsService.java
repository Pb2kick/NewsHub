package com.newshub.backend.service;

import com.newshub.backend.dto.NewsFeedItem;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.select.Elements;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.Duration;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ExternalNewsService {

    private static final DateTimeFormatter FEED_DATE_FORMATTER = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter RSS_DATE_FORMATTER = DateTimeFormatter.RFC_1123_DATE_TIME;
    private static final Pattern IMG_SRC_PATTERN = Pattern.compile("<img[^>]+src=['\"]([^'\"]+)['\"]", Pattern.CASE_INSENSITIVE);
    private static final String LOCATION_INTERNATIONAL = "International";

    private final HttpClient httpClient;
    private final boolean externalNewsEnabled;
    private final int maxItems;
    private final long cacheTtlMinutes;
    private final Map<String, CacheEntry> cacheByLocation = new ConcurrentHashMap<>();

    public ExternalNewsService(
            @Value("${news.external.enabled:true}") boolean externalNewsEnabled,
            @Value("${news.external.max-items:12}") int maxItems,
            @Value("${news.external.cache-minutes:10}") long cacheTtlMinutes
    ) {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(8))
                .build();
        this.externalNewsEnabled = externalNewsEnabled;
        this.maxItems = maxItems;
        this.cacheTtlMinutes = cacheTtlMinutes;
    }

    public List<NewsFeedItem> fetchLiveNews(String requestedLocation) {
        if (!externalNewsEnabled) {
            return List.of();
        }

        String cacheKey = normalizeLocationKey(requestedLocation);
        CacheEntry cached = cacheByLocation.get(cacheKey);
        if (cached != null && !isExpired(cached.cachedAt())) {
            return cached.items();
        }

        try {
            String query = queryForLocation(requestedLocation);
            String url = buildBingNewsRssUrl(query);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(12))
                    .header("User-Agent", "NewsHubBackend/1.0")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() > 299) {
                return cached != null ? cached.items() : List.of();
            }

            List<NewsFeedItem> parsed = parseRssItems(response.body(), requestedLocation);
            if (!parsed.isEmpty()) {
                List<NewsFeedItem> immutableItems = List.copyOf(parsed);
                cacheByLocation.put(cacheKey, new CacheEntry(immutableItems, Instant.now()));
                return immutableItems;
            }

            return cached != null ? cached.items() : List.of();
        } catch (Exception ignored) {
            return cached != null ? cached.items() : List.of();
        }
    }

    public String extractArticleContent(String sourceUrl) {
        if (sourceUrl == null || sourceUrl.isBlank()) {
            return "";
        }

        String normalizedUrl = sourceUrl.trim();
        if (!(normalizedUrl.startsWith("http://") || normalizedUrl.startsWith("https://"))) {
            return "";
        }

        try {
            Document doc = Jsoup.connect(normalizedUrl)
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                    .timeout(12000)
                    .get();

            Elements candidateParagraphs = doc.select("article p, main p, .article p, .content p, .story p, p");
            LinkedHashSet<String> uniqueParagraphs = new LinkedHashSet<>();

            for (org.jsoup.nodes.Element paragraph : candidateParagraphs) {
                String text = paragraph.text().replaceAll("\\s+", " ").trim();
                if (text.length() < 80) {
                    continue;
                }
                uniqueParagraphs.add(text);
                if (uniqueParagraphs.size() >= 12) {
                    break;
                }
            }

            if (uniqueParagraphs.isEmpty()) {
                return "";
            }

            return String.join("\n\n", uniqueParagraphs);
        } catch (Exception ignored) {
            return "";
        }
    }

    private String buildBingNewsRssUrl(String query) {
        String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
        return "https://www.bing.com/news/search?q=" + encodedQuery + "&format=rss&setlang=en-ph";
    }

    private String queryForLocation(String requestedLocation) {
        String location = requestedLocation == null || requestedLocation.isBlank() ? "National" : requestedLocation;

        if ("All".equalsIgnoreCase(location)) {
            return "Philippines latest news";
        }

        if ("National".equalsIgnoreCase(location)) {
            return "Philippines national headlines";
        }

        if (LOCATION_INTERNATIONAL.equalsIgnoreCase(location)) {
            return "world international headlines NOT Philippines";
        }

        return location + " Philippines news";
    }

    private List<NewsFeedItem> parseRssItems(String xmlContent, String requestedLocation) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(false);

        org.w3c.dom.Document document = factory.newDocumentBuilder().parse(new InputSource(new StringReader(xmlContent)));
        NodeList items = document.getElementsByTagName("item");
        List<NewsFeedItem> output = new ArrayList<>();

        for (int i = 0; i < items.getLength() && output.size() < maxItems; i++) {
            Node item = items.item(i);
            if (item.getNodeType() != Node.ELEMENT_NODE) {
                continue;
            }

            Element element = (Element) item;
            String title = textContent(element, "title", "Untitled headline");
            String rawDescription = textContent(element, "description", "Latest updates from trusted outlets.");
            String description = cleanSummary(rawDescription);
            String content = description;
            String source = sourceName(element);
            ZonedDateTime publishedAt = parsePubDate(textContent(element, "pubDate", ""));
            if (!isCurrentYear(publishedAt)) {
                continue;
            }

            String pubDate = formatPubDate(publishedAt);
            String rawArticleUrl = textContent(element, "link", "");
            String articleUrl = resolvePublisherUrl(rawArticleUrl);
            String imageUrl = extractImageUrl(element, rawDescription, articleUrl);

            output.add(new NewsFeedItem(
                    syntheticId(title, pubDate),
                    requestedLocation,
                    "Top Story",
                    title,
                    description,
                    content,
                    source,
                    pubDate,
                    "3 min read",
                    imageUrl,
                    "EXTERNAL",
                    firstNonBlank(articleUrl, null)
            ));
        }

        return output;
    }

    private long syntheticId(String title, String date) {
        return Math.abs((title + "|" + date).hashCode());
    }

    private String sourceName(Element itemElement) {
        String source = firstNonBlank(
                textContent(itemElement, "source", ""),
                textContent(itemElement, "News:Source", ""),
                textContent(itemElement, "dc:creator", "")
        );
        return firstNonBlank(source, "News Outlet");
    }

    private String extractImageUrl(Element itemElement, String rawDescription, String articleUrl) {
        String fromBingImage = textContent(itemElement, "News:Image", "");
        if (!fromBingImage.isBlank()) {
            return fromBingImage;
        }

        String fromMediaContent = extractFromMediaNodes(itemElement, "media:content");
        if (!fromMediaContent.isBlank()) {
            return fromMediaContent;
        }

        String fromMediaThumb = extractFromMediaNodes(itemElement, "media:thumbnail");
        if (!fromMediaThumb.isBlank()) {
            return fromMediaThumb;
        }

        String fromEnclosure = extractFromMediaNodes(itemElement, "enclosure");
        if (!fromEnclosure.isBlank()) {
            return fromEnclosure;
        }

        String fromDescription = extractFromDescriptionImage(rawDescription);
        if (!fromDescription.isBlank()) {
            return fromDescription;
        }

        String fromArticleMeta = extractImageFromArticleMeta(articleUrl);
        if (!fromArticleMeta.isBlank()) {
            return fromArticleMeta;
        }

        return buildArticlePreviewImage(articleUrl);
    }

    private String extractFromMediaNodes(Element itemElement, String tagName) {
        NodeList mediaNodes = itemElement.getElementsByTagName(tagName);
        for (int index = 0; index < mediaNodes.getLength(); index++) {
            Node node = mediaNodes.item(index);
            if (node.getNodeType() != Node.ELEMENT_NODE) {
                continue;
            }

            String mediaUrl = ((Element) node).getAttribute("url");
            if (mediaUrl != null && !mediaUrl.isBlank()) {
                return mediaUrl;
            }
        }

        return "";
    }

    private String extractFromDescriptionImage(String rawDescription) {
        if (rawDescription == null || rawDescription.isBlank()) {
            return "";
        }

        Matcher matcher = IMG_SRC_PATTERN.matcher(rawDescription);
        if (!matcher.find()) {
            return "";
        }

        String imageUrl = matcher.group(1);
        if (imageUrl == null || imageUrl.isBlank()) {
            return "";
        }

        return imageUrl.replace("&amp;", "&");
    }

    private String extractImageFromArticleMeta(String articleUrl) {
        if (articleUrl == null || articleUrl.isBlank()) {
            return "";
        }

        try {
            Document doc = Jsoup.connect(articleUrl)
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                    .timeout(8000)
                    .get();

            String openGraph = firstNonBlank(
                    doc.select("meta[property=og:image]").attr("content"),
                    doc.select("meta[name=twitter:image]").attr("content"),
                    doc.select("link[rel=image_src]").attr("href")
            );

            if (!openGraph.isBlank()) {
                return openGraph;
            }

            return doc.select("img[src]").stream()
                    .map(element -> element.attr("abs:src"))
                    .filter(url -> url != null && !url.isBlank())
                    .findFirst()
                    .orElse("");
        } catch (Exception ignored) {
            return "";
        }
    }

    private String resolvePublisherUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            return "";
        }

        String normalized = rawUrl.trim();
        if (!normalized.contains("bing.com/news/apiclick")) {
            return normalized;
        }

        try {
            URI uri = URI.create(normalized);
            String directUrl = queryParameter(uri.getQuery(), "url");
            return firstNonBlank(directUrl, normalized);
        } catch (Exception ignored) {
            return normalized;
        }
    }

    private String queryParameter(String query, String key) {
        if (query == null || query.isBlank()) {
            return "";
        }

        for (String pair : query.split("&")) {
            int separatorIndex = pair.indexOf('=');
            if (separatorIndex <= 0) {
                continue;
            }

            String currentKey = URLDecoder.decode(pair.substring(0, separatorIndex), StandardCharsets.UTF_8);
            if (!key.equals(currentKey)) {
                continue;
            }

            return URLDecoder.decode(pair.substring(separatorIndex + 1), StandardCharsets.UTF_8);
        }

        return "";
    }

    private String buildArticlePreviewImage(String articleUrl) {
        if (articleUrl == null || articleUrl.isBlank()) {
            return "";
        }

        String encoded = URLEncoder.encode(articleUrl, StandardCharsets.UTF_8);
        return "https://image.thum.io/get/width/1200/noanimate/" + encoded;
    }

    private String cleanSummary(String description) {
        String noTags = description.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
        noTags = noTags
                .replace("&nbsp;", " ")
                .replace("&#39;", "'")
                .replace("&amp;", "&")
                .replace("&quot;", "\"")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replaceAll("\\s+", " ")
                .trim();
        return noTags.isBlank() ? "Latest updates from trusted outlets." : noTags;
    }

    private ZonedDateTime parsePubDate(String rawPubDate) {
        if (rawPubDate == null || rawPubDate.isBlank()) {
            return null;
        }

        try {
            return ZonedDateTime.parse(rawPubDate, RSS_DATE_FORMATTER);
        } catch (Exception ignored) {
            return null;
        }
    }

    private boolean isCurrentYear(ZonedDateTime publishedAt) {
        if (publishedAt == null) {
            return false;
        }

        return publishedAt.getYear() == ZonedDateTime.now().getYear();
    }

    private String formatPubDate(ZonedDateTime parsed) {
        try {
            return FEED_DATE_FORMATTER.format(parsed);
        } catch (Exception ignored) {
            return "Latest";
        }
    }

    private String textContent(Element parent, String tagName, String fallback) {
        NodeList nodes = parent.getElementsByTagName(tagName);
        if (nodes.getLength() == 0) {
            return fallback;
        }
        String value = nodes.item(0).getTextContent();
        return firstNonBlank(value, fallback);
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
    }

    private String normalizeLocationKey(String requestedLocation) {
        if (requestedLocation == null || requestedLocation.isBlank()) {
            return "national";
        }
        return requestedLocation.trim().toLowerCase(Locale.ROOT);
    }

    private boolean isExpired(Instant cachedAt) {
        return cachedAt.plus(Duration.ofMinutes(cacheTtlMinutes)).isBefore(Instant.now());
    }

    private record CacheEntry(List<NewsFeedItem> items, Instant cachedAt) {
    }
}
