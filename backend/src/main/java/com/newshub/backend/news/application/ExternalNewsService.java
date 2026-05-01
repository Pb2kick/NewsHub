package com.newshub.backend.news.application;

import com.newshub.backend.news.api.dto.NewsFeedItem;
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
import java.net.MalformedURLException;
import java.net.URL;
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
import java.util.Comparator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ExternalNewsService {

    private static final DateTimeFormatter FEED_DATE_FORMATTER = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter RSS_DATE_FORMATTER = DateTimeFormatter.RFC_1123_DATE_TIME;
    private static final Pattern IMG_SRC_PATTERN = Pattern.compile("<img[^>]+src=['\"]([^'\"]+)['\"]", Pattern.CASE_INSENSITIVE);
    private static final Pattern WIDTH_PARAM_PATTERN = Pattern.compile("([?&](?:w|width|wid)=)(\\d{2,5})", Pattern.CASE_INSENSITIVE);
    private static final Pattern QUALITY_PARAM_PATTERN = Pattern.compile("([?&](?:q|quality)=)(\\d{1,3})", Pattern.CASE_INSENSITIVE);
    private static final Pattern SMALL_DIMENSION_PATTERN = Pattern.compile("(\\d{2,3})x(\\d{2,3})", Pattern.CASE_INSENSITIVE);
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

    /**
     * Fetches live RSS news for a location scope and country context.
     *
     * @param requestedLocation selected scope or resolved area
     * @param requestedCountry selected country context
     * @return feed items from cache or live source
     */
    public List<NewsFeedItem> fetchLiveNews(String requestedLocation, String requestedCountry) {
        if (!externalNewsEnabled) {
            return List.of();
        }

        invalidateCacheForCountry(requestedCountry);
        String cacheKey = normalizeLocationKey(requestedLocation, requestedCountry);
        CacheEntry cached = cacheByLocation.get(cacheKey);
        if (cached != null && !isExpired(cached.cachedAt())) {
            return cached.items();
        }

        try {
            String query = queryForLocation(requestedLocation, requestedCountry);
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

    /**
     * Extracts article body text from a source URL using strict relevance filtering.
     *
     * @param sourceUrl source article URL
     * @return extracted article body text
     */
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

            Elements candidateParagraphs = extractCandidateParagraphs(doc);
            LinkedHashSet<String> uniqueParagraphs = new LinkedHashSet<>();

            for (org.jsoup.nodes.Element paragraph : candidateParagraphs) {
                String text = paragraph.text().replaceAll("\\s+", " ").trim();
                if (!isRelevantParagraph(text)) {
                    continue;
                }
                uniqueParagraphs.add(text);
                if (uniqueParagraphs.size() >= 32) {
                    break;
                }
            }

            if (uniqueParagraphs.isEmpty()) {
                return "";
            }

            return normalizeExtractedContent(String.join("\n\n", uniqueParagraphs));
        } catch (Exception ignored) {
            return "";
        }
    }

    /**
     * Cleans extracted article text and removes common truncation markers.
     *
     * @param extractedContent raw extracted content
     * @return normalized content with complete ending when possible
     */
    private String normalizeExtractedContent(String extractedContent) {
        if (extractedContent == null || extractedContent.isBlank()) {
            return "";
        }

        String collapsed = extractedContent.replaceAll("\\s+", " ").trim();
        if (collapsed.isBlank()) {
            return "";
        }

        String withoutEllipsis = collapsed.replaceAll("(?:\\.\\.\\.|\\u2026)+\\s*$", "").trim();
        if (withoutEllipsis.isBlank()) {
            return "";
        }

        int period = withoutEllipsis.lastIndexOf('.');
        int exclamation = withoutEllipsis.lastIndexOf('!');
        int question = withoutEllipsis.lastIndexOf('?');
        int lastSentenceEnd = Math.max(period, Math.max(exclamation, question));

        if (lastSentenceEnd > (withoutEllipsis.length() / 2)) {
            return withoutEllipsis.substring(0, lastSentenceEnd + 1).trim();
        }

        return withoutEllipsis;
    }

    private String buildBingNewsRssUrl(String query) {
        String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
        return "https://www.bing.com/news/search?q=" + encodedQuery + "&format=rss&setlang=en-ph";
    }

    /**
     * Builds RSS search query from location scope and country context.
     *
     * @param requestedLocation selected scope or resolved area
     * @param requestedCountry selected country context
     * @return encoded query input for news search
     */
    private String queryForLocation(String requestedLocation, String requestedCountry) {
        String country = requestedCountry == null || requestedCountry.isBlank() ? "Philippines" : requestedCountry;
        String location = requestedLocation == null || requestedLocation.isBlank() ? "National" : requestedLocation;

        if ("All".equalsIgnoreCase(location)) {
            return country + " latest news";
        }

        if ("National".equalsIgnoreCase(location)) {
            return country + " national headlines";
        }

        if (LOCATION_INTERNATIONAL.equalsIgnoreCase(location)) {
            return "world international headlines near " + country + " NOT " + country;
        }

        return location + " " + country + " news";
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
            String feedCategory = firstNonBlank(
                    textContent(element, "category", ""),
                    textContent(element, "News:Category", "")
            );
            ZonedDateTime publishedAt = parsePubDate(textContent(element, "pubDate", ""));
            if (!isCurrentYear(publishedAt)) {
                continue;
            }

            String pubDate = formatPubDate(publishedAt);
            String rawArticleUrl = textContent(element, "link", "");
            String articleUrl = resolvePublisherUrl(rawArticleUrl);
            String imageUrl = extractImageUrl(element, rawDescription, articleUrl);
                String category = classifyFeedCategory(feedCategory, source, title, description);

            output.add(new NewsFeedItem(
                    syntheticId(title, pubDate),
                    requestedLocation,
                    category,
                    title,
                    description,
                    content,
                    source,
                    pubDate,
                    "3 min read",
                    imageUrl,
                    "EXTERNAL",
                    firstNonBlank(articleUrl, null),
                    resolvePublisherImage(articleUrl)
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

    /**
     * Classifies RSS feed items into homepage categories using explicit feed category
     * and permissive text keyword fallback.
     *
     * @param feedCategory explicit RSS category when available
     * @param source publisher/source string
     * @param title article title
     * @param description article summary text
     * @return category label aligned with homepage tabs
     */
    private String classifyFeedCategory(String feedCategory, String source, String title, String description) {
        String explicit = firstNonBlank(feedCategory, "").toLowerCase(Locale.ROOT);
        if (containsAny(explicit, "politic", "government")) {
            return "Politics";
        }
        if (containsAny(explicit, "econom", "business", "finance")) {
            return "Economy";
        }
        if (containsAny(explicit, "tech", "technology", "science", "digital")) {
            return "Technology";
        }
        if (containsAny(explicit, "elect", "vote", "campaign")) {
            return "Elections";
        }

        String searchable = (firstNonBlank(source, "") + " "
                + firstNonBlank(title, "") + " "
                + firstNonBlank(description, "")).toLowerCase(Locale.ROOT);

        if (containsAny(searchable, "election", "vote", "voting", "candidate", "campaign", "ballot", "poll")) {
            return "Elections";
        }
        if (containsAny(searchable, "technology", "tech", "cyber", "digital", "software", "ai", "data", "platform")) {
            return "Technology";
        }
        if (containsAny(searchable, "economy", "economic", "business", "market", "finance", "inflation", "trade", "gdp")) {
            return "Economy";
        }
        if (containsAny(searchable, "politic", "government", "senate", "congress", "policy", "commission", "legislation")) {
            return "Politics";
        }

        return "Top Stories";
    }

    /**
     * Determines whether normalized text contains any keyword.
     *
     * @param searchable normalized searchable text
     * @param keywords keyword list
     * @return true when any keyword is present
     */
    private boolean containsAny(String searchable, String... keywords) {
        for (String keyword : keywords) {
            if (searchable.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private String extractImageUrl(Element itemElement, String rawDescription, String articleUrl) {
        String fromBingImage = normalizeImageUrl(textContent(itemElement, "News:Image", ""));
        if (!fromBingImage.isBlank()) {
            return fromBingImage;
        }

        String fromMediaContent = normalizeImageUrl(extractFromMediaNodes(itemElement, "media:content"));
        if (!fromMediaContent.isBlank()) {
            return fromMediaContent;
        }

        String fromMediaThumb = normalizeImageUrl(extractFromMediaNodes(itemElement, "media:thumbnail"));
        if (!fromMediaThumb.isBlank()) {
            return fromMediaThumb;
        }

        String fromEnclosure = normalizeImageUrl(extractFromMediaNodes(itemElement, "enclosure"));
        if (!fromEnclosure.isBlank()) {
            return fromEnclosure;
        }

        String fromDescription = normalizeImageUrl(extractFromDescriptionImage(rawDescription));
        if (!fromDescription.isBlank()) {
            return fromDescription;
        }

        String fromArticleMeta = normalizeImageUrl(extractImageFromArticleMeta(articleUrl));
        if (!fromArticleMeta.isBlank()) {
            return fromArticleMeta;
        }

        return "";
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

                List<String> candidates = new ArrayList<>();
                candidates.add(doc.select("meta[property=og:image]").attr("abs:content"));
                candidates.add(doc.select("meta[name=twitter:image]").attr("abs:content"));
                candidates.add(doc.select("link[rel=image_src]").attr("abs:href"));
                doc.select("img[src]").stream()
                    .limit(10)
                    .map(element -> element.attr("abs:src"))
                    .forEach(candidates::add);

                return candidates.stream()
                    .map(this::normalizeImageUrl)
                    .filter(value -> !value.isBlank())
                    .sorted(Comparator.comparingInt(this::imageQualityScore).reversed())
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

    /**
     * Normalizes image URLs and boosts common low-resolution CDN parameters.
     *
     * <p>th.bing.com thumbnails are handled in a dedicated early branch because
     * their URLs contain the word "th" / path "/th?" which causes
     * {@link #looksLikeLowQualityImage} to reject them before the width boost
     * can be applied. The Bing branch upsizes to 1200×675 and removes the
     * crop-mode lock ({@code c=} parameter) so the CDN serves an uncropped
     * high-quality rendition.
     *
     * @param imageUrl raw image URL
     * @return optimized image URL or empty string when invalid
     */
    private String normalizeImageUrl(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            return "";
        }

        String normalized = imageUrl.trim().replace("&amp;", "&");
        if (!(normalized.startsWith("http://") || normalized.startsWith("https://"))) {
            return "";
        }

        if (normalized.contains("image.thum.io")) {
            return "";
        }

        // --- Dedicated branch for th.bing.com CDN thumbnails ---
        // Must run BEFORE looksLikeLowQualityImage because the URL path "/th?"
        // contains "th" which matches the "thumb" keyword check and causes
        // premature rejection. We boost resolution here and return immediately.
        if (normalized.contains("th.bing.com")) {
            // Boost or inject width to 1200.
            if (WIDTH_PARAM_PATTERN.matcher(normalized).find()) {
                normalized = WIDTH_PARAM_PATTERN.matcher(normalized).replaceAll("$11200");
            } else {
                normalized += (normalized.contains("?") ? "&" : "?") + "w=1200";
            }
            // Boost or inject height to 675 (16:9).
            Pattern heightPattern = Pattern.compile("([?&](?:h|height)=)(\\d{2,5})", Pattern.CASE_INSENSITIVE);
            if (heightPattern.matcher(normalized).find()) {
                normalized = heightPattern.matcher(normalized).replaceAll("$1675");
            } else {
                normalized += "&h=675";
            }
            // Remove the crop-mode lock (c=7, c=1, etc.) so the CDN serves an
            // uncropped rendition at the requested dimensions.
            normalized = normalized.replaceAll("[?&]c=\\d+", "")
                    .replaceAll("\\?&", "?"); // clean up leading & if c= was the first param
            return normalized;
        }

        if (looksLikeLowQualityImage(normalized)) {
            return "";
        }

        normalized = WIDTH_PARAM_PATTERN.matcher(normalized).replaceAll("$11600");
        normalized = QUALITY_PARAM_PATTERN.matcher(normalized).replaceAll("$180");
        return normalized;
    }

    /**
     * Returns candidate paragraph elements from common article containers.
     *
     * @param doc parsed article document
     * @return candidate paragraph elements
     */
    private Elements extractCandidateParagraphs(Document doc) {
        Elements articleParagraphs = doc.select("article p, main article p, [itemprop=articleBody] p, .article-body p, .story-body p");
        if (!articleParagraphs.isEmpty()) {
            return articleParagraphs;
        }

        Elements mainParagraphs = doc.select("main p, .content p, .post-content p, .entry-content p");
        if (!mainParagraphs.isEmpty()) {
            return mainParagraphs;
        }

        return doc.select("p");
    }

    /**
     * Validates whether paragraph text likely belongs to article body.
     *
     * @param text paragraph text
     * @return true if paragraph appears relevant
     */
    private boolean isRelevantParagraph(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }

        String normalized = text.trim();
        if (normalized.length() < 70) {
            return false;
        }

        String lower = normalized.toLowerCase(Locale.ROOT);
        if (lower.contains("subscribe") || lower.contains("cookie") || lower.contains("advertisement") || lower.contains("sign up")) {
            return false;
        }

        return normalized.chars().filter(Character::isLetter).count() >= 40;
    }

    /**
     * Evaluates whether image URL likely points to low-quality or thumbnail asset.
     *
     * @param imageUrl normalized image URL
     * @return true when URL likely points to low-quality asset
     */
    private boolean looksLikeLowQualityImage(String imageUrl) {
        String lower = imageUrl.toLowerCase(Locale.ROOT);
        if (lower.contains("thumbnail") || lower.contains("thumb") || lower.contains("icon") || lower.contains("sprite") || lower.contains("logo-")) {
            return true;
        }

        Matcher sizeMatcher = SMALL_DIMENSION_PATTERN.matcher(lower);
        if (sizeMatcher.find()) {
            int width = Integer.parseInt(sizeMatcher.group(1));
            int height = Integer.parseInt(sizeMatcher.group(2));
            return width < 280 || height < 180;
        }

        return false;
    }

    /**
     * Produces a score favoring high-resolution and full-size image URLs.
     *
     * @param imageUrl candidate image URL
     * @return relative quality score
     */
    private int imageQualityScore(String imageUrl) {
        int score = 0;
        String lower = imageUrl.toLowerCase(Locale.ROOT);
        if (lower.contains("1600") || lower.contains("1400") || lower.contains("1200")) {
            score += 4;
        }
        if (lower.contains("q=80") || lower.contains("quality=80")) {
            score += 2;
        }
        if (lower.contains("hero") || lower.contains("full")) {
            score += 2;
        }
        return score;
    }

    /**
     * Resolves a publisher avatar/logo URL from source domain.
     *
     * @param articleUrl article source URL
     * @return publisher image URL or empty when unavailable
     */
    private String resolvePublisherImage(String articleUrl) {
        if (articleUrl == null || articleUrl.isBlank()) {
            return "";
        }

        try {
            URL parsed = URI.create(articleUrl).toURL();
            String host = parsed.getHost();
            if (host == null || host.isBlank()) {
                return "";
            }
            return "https://www.google.com/s2/favicons?domain=" + URLEncoder.encode(host, StandardCharsets.UTF_8) + "&sz=128";
        } catch (MalformedURLException | IllegalArgumentException ignored) {
            return "";
        }
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

    /**
     * Generates cache key by location and country context.
     *
     * @param requestedLocation selected scope or resolved area
     * @param requestedCountry selected country context
     * @return normalized cache key
     */
    private String normalizeLocationKey(String requestedLocation, String requestedCountry) {
        String country = requestedCountry == null || requestedCountry.isBlank() ? "philippines" : requestedCountry;
        if (requestedLocation == null || requestedLocation.isBlank()) {
            return "national|" + country.trim().toLowerCase(Locale.ROOT);
        }
        return requestedLocation.trim().toLowerCase(Locale.ROOT) + "|" + country.trim().toLowerCase(Locale.ROOT);
    }

    /**
     * Clears cached feeds for all countries except the active one.
     *
     * @param requestedCountry selected country context
     */
    private void invalidateCacheForCountry(String requestedCountry) {
        String normalizedCountry = (requestedCountry == null || requestedCountry.isBlank())
                ? "philippines"
                : requestedCountry.trim().toLowerCase(Locale.ROOT);

        cacheByLocation.entrySet().removeIf((entry) -> {
            String key = entry.getKey();
            int separator = key.lastIndexOf('|');
            if (separator < 0 || separator + 1 >= key.length()) {
                return false;
            }
            String countrySegment = key.substring(separator + 1).trim().toLowerCase(Locale.ROOT);
            return !countrySegment.equals(normalizedCountry);
        });
    }

    private boolean isExpired(Instant cachedAt) {
        return cachedAt.plus(Duration.ofMinutes(cacheTtlMinutes)).isBefore(Instant.now());
    }

    private record CacheEntry(List<NewsFeedItem> items, Instant cachedAt) {
    }
}
