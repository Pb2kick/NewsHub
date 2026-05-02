package com.newshub.backend.news.application;

import com.newshub.backend.news.api.dto.NewsFeedItem;
import com.newshub.backend.news.domain.NewsArticle;
import com.newshub.backend.news.infrastructure.persistence.NewsArticleRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Service
public class NewsService {

    private static final String LOCATION_ALL = "All";
    private static final String LOCATION_NATIONAL = "National";
    private static final String LOCATION_LOCAL = "Local";
    private static final String LOCATION_INTERNATIONAL = "International";

    private static final DateTimeFormatter FEED_DATE_FORMATTER = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.ENGLISH);
    private static final String LEGACY_STATIC_IMAGE = "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80";

    private final NewsArticleRepository newsArticleRepository;
    private final ExternalNewsService externalNewsService;

    /**
     * Creates the news service with persistence and live feed dependencies.
     *
     * @param newsArticleRepository repository for local news records
     * @param externalNewsService service for live external feeds
     */
    public NewsService(NewsArticleRepository newsArticleRepository, ExternalNewsService externalNewsService) {
        this.newsArticleRepository = newsArticleRepository;
        this.externalNewsService = externalNewsService;
    }

    /**
     * Returns current-year news for the requested location mode.
     *
     * @param location location mode or resolved region name
     * @param latitude optional latitude for local mode
     * @param longitude optional longitude for local mode
     * @param country selected country context
     * @param area selected area context
     * @return ordered list of feed items
     */
    public List<NewsFeedItem> getNews(String location, Double latitude, Double longitude, String country, String area) {
        String requestedCountry = normalizeCountry(country);
        String requestedLocation = normalizeLocation(location, latitude, longitude, area);
        List<NewsFeedItem> liveNews = externalNewsService.fetchLiveNews(requestedLocation, requestedCountry);
        if (!liveNews.isEmpty()) {
            persistExternalNews(liveNews, requestedLocation, requestedCountry);
            return liveNews;
        }

        if (LOCATION_ALL.equalsIgnoreCase(requestedLocation)) {
            return newsArticleRepository.findAllByOrderByPublishedAtDescIdDesc()
                    .stream()
                .filter(article -> isCurrentYear(article.getPublishedAt()))
                    .map(this::toFeedItem)
                    .toList();
        }

        if (LOCATION_NATIONAL.equalsIgnoreCase(requestedLocation)) {
            return newsArticleRepository.findNationalNews(requestedCountry, LOCATION_NATIONAL)
                    .stream()
                .filter(article -> isCurrentYear(article.getPublishedAt()))
                    .map(this::toFeedItem)
                    .toList();
        }

        if (LOCATION_INTERNATIONAL.equalsIgnoreCase(requestedLocation)) {
            return newsArticleRepository.findInternationalNews(LOCATION_NATIONAL, requestedCountry)
                    .stream()
                    .filter(article -> isCurrentYear(article.getPublishedAt()))
                    .map(this::toFeedItem)
                    .toList();
        }

        return newsArticleRepository.findNationalAndRegion(LOCATION_NATIONAL, requestedCountry, requestedLocation)
                .stream()
            .filter(article -> isCurrentYear(article.getPublishedAt()))
                .map(this::toFeedItem)
                .toList();
    }

    /**
     * Searches persisted articles whose title, summary, or content contain the
     * given keyword phrase, scoped to the user's current location.
     *
     * Dispatches to the appropriate repository query based on the location mode:
     *  - Local         → searchByKeywordAndArea    (matches region or country)
     *  - National      → searchByKeywordAndNational (matches domestic country / National tag)
     *  - International → searchByKeywordAndInternational (excludes domestic country)
     *  - null / unresolved → List.of() — never dumps the whole DB on an unscoped request.
     *
     * Returns at most 8 results ordered by publish date.
     *
     * @param query    raw search query from the user
     * @param location scope mode: Local, National, or International
     * @param area     resolved area for Local scope (e.g. "New Orleans")
     * @param country  resolved country for National scope (e.g. "United States")
     * @return list of matching feed items, empty when query or location context is blank
     */
    public List<NewsFeedItem> searchNews(String query, String location, String area, String country) {
        if (query == null || query.isBlank()) {
            return List.of();
        }

        // FIX A+B: Reject unresolved context immediately — no country default injected here.
        // normalizeCountry() is intentionally NOT called so a null country from the frontend
        // cannot silently become "Philippines" and cross-contaminate results for other locales.
        // If both location and country are absent the request arrived before the frontend's
        // locationContext resolved; returning an empty list is the safe, correct behaviour.
        if ((location == null || location.isBlank()) && (country == null || country.isBlank())) {
            return List.of(); // location context not yet resolved — do not query
        }

        String keyword = query.trim();
        PageRequest page = PageRequest.of(0, 8);
        // Use country as-is; blank/null means the caller has not resolved it yet.
        String resolvedCountry = (country != null && !country.isBlank()) ? country.trim() : "";

        if (LOCATION_LOCAL.equalsIgnoreCase(location) && area != null && !area.isBlank()) {
            return newsArticleRepository
                    .searchByKeywordAndArea(keyword, area.trim(), resolvedCountry, page)
                    .stream()
                    .map(this::toFeedItem)
                    .toList();
        }

        if (LOCATION_NATIONAL.equalsIgnoreCase(location)) {
            return newsArticleRepository
                    .searchByKeywordAndNational(keyword, resolvedCountry, LOCATION_NATIONAL, page)
                    .stream()
                    .map(this::toFeedItem)
                    .toList();
        }

        if (LOCATION_INTERNATIONAL.equalsIgnoreCase(location)) {
            return newsArticleRepository
                    .searchByKeywordAndInternational(keyword, LOCATION_NATIONAL, resolvedCountry, page)
                    .stream()
                    .map(this::toFeedItem)
                    .toList();
        }

        // FIX B: location is present but doesn't match any known mode (e.g. a raw area name
        // arriving before the frontend normalises it). Return empty — never fall through to
        // the unscoped searchByKeyword which would dump the entire database.
        return List.of(); // unknown/unsupported location mode — do not query
    }

    /**
     * Normalizes incoming location mode to a concrete location used for lookups.
     *
     * @param location incoming location mode
     * @param latitude optional latitude
     * @param longitude optional longitude
     * @param area selected area context
     * @return normalized lookup location
     */
    private String normalizeLocation(String location, Double latitude, Double longitude, String area) {
        if (location == null || location.isBlank()) {
            return firstNonBlank(area, resolveLocationFromCoordinates(latitude, longitude));
        }

        if (LOCATION_LOCAL.equalsIgnoreCase(location)) {
            if (area != null && !area.isBlank()) {
                return area;
            }
            return resolveLocationFromCoordinates(latitude, longitude);
        }

        return location;
    }

    /**
     * Normalizes country context with safe fallback.
     *
     * @param country selected country context
     * @return normalized country value
     */
    private String normalizeCountry(String country) {
        return firstNonBlank(country, "Philippines");
    }

    /**
     * Resolves a deterministic local area from coordinates.
     *
     * @param latitude latitude value
     * @param longitude longitude value
     * @return resolved area name
     */
    private String resolveLocationFromCoordinates(Double latitude, Double longitude) {
        if (Objects.isNull(latitude) || Objects.isNull(longitude)) {
            return "Metro District";
        }

        // Temporary deterministic mapping while reverse-geocoding is not integrated.
        if (longitude < 121.0) {
            return "North Province";
        }

        if (latitude < 14.4) {
            return "Central Region";
        }

        return "Metro District";
    }

    /**
     * Maps a persisted entity to API feed shape.
     *
     * @param article news entity
     * @return mapped feed item
     */
    private NewsFeedItem toFeedItem(NewsArticle article) {
        String effectiveLocation = firstNonBlank(article.getRegion(), article.getCountry(), LOCATION_NATIONAL);
        String excerpt = firstNonBlank(article.getSummary(), truncate(article.getContent(), 180), "No summary available.");
        String author = firstNonBlank(article.getSource(), "NewsHub Desk");
        String category = classifyCategory(article.getSource(), article.getTitle(), article.getSummary(), article.getContent());
        String image = sanitizeImageUrl(article.getMediaUrls());
        String date = article.getPublishedAt() != null
                ? FEED_DATE_FORMATTER.format(article.getPublishedAt())
                : "Unknown date";
        String readTime = estimateReadTime(article.getContent());

        return new NewsFeedItem(
                article.getId(),
                effectiveLocation,
                category,
                article.getTitle(),
                excerpt,
            firstNonBlank(article.getContent(), excerpt),
                author,
                date,
                readTime,
                image,
            "DATABASE",
            null,
            null
        );
    }

    /**
     * Stores fresh external items while avoiding duplicate rows.
     *
     * @param liveNews fetched live items
     * @param requestedLocation resolved location used to derive country and region
     * @param requestedCountry selected country context
     */
    private void persistExternalNews(List<NewsFeedItem> liveNews, String requestedLocation, String requestedCountry) {
        List<NewsArticle> upsertArticles = liveNews.stream()
            .map(item -> {
                String normalizedImage = sanitizeImageUrl(item.image());
                NewsArticle existingArticle = newsArticleRepository
                    .findFirstByTitleIgnoreCaseAndSourceIgnoreCase(item.title(), item.author())
                    .orElse(null);

                if (existingArticle != null) {
                String currentImage = sanitizeImageUrl(existingArticle.getMediaUrls());
                if (currentImage.isBlank() && !normalizedImage.isBlank()) {
                    existingArticle.setMediaUrls(normalizedImage);
                    return existingArticle;
                }
                return null;
                }

                return new NewsArticle(
                    item.title(),
                    item.excerpt(),
                    firstNonBlank(item.content(), item.excerpt()),
                    normalizedImage,
                    item.author(),
                    resolveCountryForLocation(requestedLocation, requestedCountry),
                    resolveRegionForLocation(requestedLocation),
                    parseFeedDate(item.date()),
                    null
                );
            })
            .filter(Objects::nonNull)
                .toList();

        if (!upsertArticles.isEmpty()) {
            newsArticleRepository.saveAll(upsertArticles);
        }
    }

    /**
     * Parses feed date text into a persisted timestamp.
     *
     * @param feedDate feed date in MMM d, yyyy format
     * @return parsed date or current time when parsing fails
     */
    private LocalDateTime parseFeedDate(String feedDate) {
        if (feedDate == null || feedDate.isBlank() || "Latest".equalsIgnoreCase(feedDate)) {
            return LocalDateTime.now();
        }
        try {
            return LocalDateTime.parse(feedDate + " 00:00", DateTimeFormatter.ofPattern("MMM d, yyyy HH:mm", Locale.ENGLISH));
        } catch (Exception ignored) {
            return LocalDateTime.now();
        }
    }

    /**
     * Derives country classification from selected location.
     *
     * @param requestedLocation selected location
     * @param requestedCountry selected country context
     * @return country value for persistence
     */
    private String resolveCountryForLocation(String requestedLocation, String requestedCountry) {
        if (LOCATION_NATIONAL.equalsIgnoreCase(requestedLocation) || LOCATION_ALL.equalsIgnoreCase(requestedLocation)) {
            return requestedCountry;
        }

        if (LOCATION_INTERNATIONAL.equalsIgnoreCase(requestedLocation)) {
            return "International";
        }

        return "Philippines";
    }

    /**
     * Derives region value from selected location.
     *
     * @param requestedLocation selected location
     * @return region value or null for non-regional modes
     */
    private String resolveRegionForLocation(String requestedLocation) {
        if (requestedLocation == null || requestedLocation.isBlank()) {
            return "Metro District";
        }
        if (LOCATION_NATIONAL.equalsIgnoreCase(requestedLocation)
                || LOCATION_ALL.equalsIgnoreCase(requestedLocation)
                || LOCATION_INTERNATIONAL.equalsIgnoreCase(requestedLocation)) {
            return null;
        }
        return requestedLocation;
    }

    /**
     * Classifies article category using explicit source cues and text keywords.
     *
     * @param source article source
     * @param title article title
     * @param summary article summary
     * @param content article content
     * @return category label aligned with homepage tabs
     */
    private String classifyCategory(String source, String title, String summary, String content) {
        String searchable = (firstNonBlank(source, "") + " "
                + firstNonBlank(title, "") + " "
                + firstNonBlank(summary, "") + " "
                + firstNonBlank(content, "")).toLowerCase(Locale.ROOT);

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
     * Determines whether any keyword exists in normalized text.
     *
     * @param searchable normalized searchable text
     * @param keywords keyword list
     * @return true when any keyword matches
     */
    private boolean containsAny(String searchable, String... keywords) {
        for (String keyword : keywords) {
            if (searchable.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Estimates reading time based on article word count.
     *
     * @param content article content
     * @return read-time label
     */
    private String estimateReadTime(String content) {
        if (content == null || content.isBlank()) {
            return "3 min read";
        }
        int words = content.trim().split("\\s+").length;
        int minutes = Math.max(1, (int) Math.ceil(words / 200.0));
        return minutes + " min read";
    }

    /**
     * Truncates text with ellipsis to fit the configured limit.
     *
     * @param text source text
     * @param maxLength maximum character count
     * @return truncated text
     */
    private String truncate(String text, int maxLength) {
        if (text == null || text.isBlank()) {
            return "";
        }
        if (text.length() <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength - 3) + "...";
    }

    /**
     * Normalizes image URL and removes deprecated static placeholder image.
     *
     * @param imageUrl raw image URL
     * @return normalized image URL or empty string
     */
    private String sanitizeImageUrl(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            return "";
        }

        String normalized = imageUrl.trim();
        if (LEGACY_STATIC_IMAGE.equals(normalized)) {
            return "";
        }

        return normalized;
    }

    /**
     * Validates that an article belongs to the current calendar year.
     *
     * @param publishedAt publish timestamp
     * @return true when article is from current year
     */
    private boolean isCurrentYear(LocalDateTime publishedAt) {
        if (publishedAt == null) {
            return false;
        }

        return publishedAt.getYear() == LocalDateTime.now().getYear();
    }

    /**
     * Returns the first non-empty string from a sequence.
     *
     * @param values candidate values
     * @return first non-blank value or empty string
     */
    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
    }
}
