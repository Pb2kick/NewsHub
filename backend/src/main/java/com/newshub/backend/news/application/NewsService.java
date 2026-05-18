package com.newshub.backend.news.application;

import com.newshub.backend.news.api.dto.NewsFeedItem;
import com.newshub.backend.news.api.dto.NewsFeedPage;
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
     * Returns location-aware news using a DB-first strategy.
     *
     * Serving order:
     *  1. Count current-year articles in DB for the resolved location scope.
     *  2. If count &gt; 0 → serve directly from DB (fast path, no outbound HTTP).
     *  3. If count == 0 → call fetchLiveNews() once to populate the DB, then
     *     serve page 0 from DB.
     *
     * @param location  scope mode (Local, National, International)
     * @param latitude  optional latitude for Local scope
     * @param longitude optional longitude for Local scope
     * @param country   selected country context
     * @param area      selected area context
     * @param page      0-indexed page number
     * @param size      page size (number of articles per page)
     * @return paginated feed page
     */
    public NewsFeedPage getNews(String location, Double latitude, Double longitude,
                                String country, String area, int page, int size) {
        String requestedCountry = normalizeCountry(country);
        String requestedLocation = normalizeLocation(location, latitude, longitude, area);
        int currentYear = LocalDateTime.now().getYear();

        // Country must be explicitly provided by the frontend. Returning empty feed for unresolved location prevents cross-user DB
        // contamination. Frontend's loadLocationNews() already guards this.
        if (requestedCountry.isBlank() || requestedLocation.isBlank()) {
            return new NewsFeedPage(List.of(), 0, false);
        }

        // DB-first: only call live fetch when the DB has no current-year articles for this scope.
        long existingCount = countForScope(requestedLocation, requestedCountry, currentYear);
        if (existingCount == 0) {
            List<NewsFeedItem> liveNews = externalNewsService.fetchLiveNews(requestedLocation, requestedCountry);
            if (!liveNews.isEmpty()) {
                persistExternalNews(liveNews, requestedLocation, requestedCountry);
            }
        }

        return servePagedFromDb(requestedLocation, requestedCountry, page, size);
    }

    /**
     * Searches persisted articles whose title, summary, or content contain the
     * given keyword phrase, scoped to the user's current location.
     *
     * Dispatches to the appropriate repository query based on the location mode:
     *  - Local         → searchByKeywordAndArea    (matches region only — BUG 2 FIX: country OR branch removed)
     *  - National      → searchByKeywordAndNational (matches domestic country, excludes region-tagged Local rows)
     *  - International → searchByKeywordAndInternational (matches country='International' AND region=:domesticCountry — BUG 1 FIX)
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

        if (LOCATION_NATIONAL.equalsIgnoreCase(location)
                && (country == null || country.isBlank())) {
            return List.of(); // country unresolved — do not query national scope
        }

        String keyword = query.trim();
        PageRequest page = PageRequest.of(0, 8);
        // Use country as-is; blank/null means the caller has not resolved it yet.
        String resolvedCountry = (country != null && !country.isBlank()) ? country.trim() : "";

        if (LOCATION_LOCAL.equalsIgnoreCase(location) && area != null && !area.isBlank()) {
            return newsArticleRepository
                    // BUG 2 FIX: country param removed from Local search — region-only match
                    // prevents National articles from bleeding into Local search results.
                    .searchByKeywordAndArea(keyword, area.trim(), page)
                    .stream()
                    .map(this::toFeedItem)
                    .toList();
        }

        if (LOCATION_NATIONAL.equalsIgnoreCase(location)) {
            return newsArticleRepository
                    .searchByKeywordAndNational(keyword, resolvedCountry, page)
                    .stream()
                    .map(this::toFeedItem)
                    .toList();
        }

        if (LOCATION_INTERNATIONAL.equalsIgnoreCase(location)) {
            return newsArticleRepository
                    // BUG 1 FIX: nationalCountry param removed — new query matches
                    // country='international' AND region=:domesticCountry instead of NOT IN.
                    .searchByKeywordAndInternational(keyword, resolvedCountry, page)
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
        if (country == null || country.isBlank()) {
            return "";
        }
        return country.trim();
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
            article.getSourceUrl(),
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
                    item.sourceUrl(),
                    resolveCountryForLocation(requestedLocation, requestedCountry),
                    // BUG 1 FIX: pass requestedCountry so the 2-arg overload can store
                    // domestic country in region for International-scoped articles.
                    resolveRegionForLocation(requestedLocation, requestedCountry),
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

        return requestedCountry; // FIX 1: was "Philippines" — hardcoded for PH-only launch; must use actual user country so articles are tagged correctly for all locales
    }

    /**
     * Derives region value from selected location.
     *
     * @param requestedLocation selected location
     * @return region value or null for non-regional modes
     */
    private String resolveRegionForLocation(String requestedLocation) {
        // BUG 4 FIX: null/blank input no longer hard-defaults to a Philippines area.
        // Returning null is safe — country column alone identifies the article's scope.
        if (requestedLocation == null || requestedLocation.isBlank()) {
            return null; // was "Metro District" — removed PH-hardcoded default
        }
        if (LOCATION_NATIONAL.equalsIgnoreCase(requestedLocation)
                || LOCATION_ALL.equalsIgnoreCase(requestedLocation)) {
            return null; // National/All articles carry no region tag
        }
        // BUG 1 FIX: International scope handled by the overloaded variant below;
        // this branch is never reached for International — kept for clarity.
        return requestedLocation; // Local / resolved area name
    }

    /**
     * Derives region value for International scope articles.
     *
     * BUG 1 FIX: stores the user's domestic country in the region column so
     * International articles are country-scoped without adding a new DB column.
     * Schema: country="International", region="United States" (for US user).
     *
     * @param requestedLocation selected location mode
     * @param requestedCountry  user's domestic country
     * @return region value to persist
     */
    private String resolveRegionForLocation(String requestedLocation, String requestedCountry) {
        if (LOCATION_INTERNATIONAL.equalsIgnoreCase(requestedLocation)) {
            // Store domestic country in region so each user's International articles
            // are distinguishable from every other country's International articles.
            return requestedCountry; // was null — caused all-user cross-contamination
        }
        return resolveRegionForLocation(requestedLocation); // delegate for all other modes
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
     * Serves a single page of current-year articles from the DB for the given scope.
     * Computes totalCount and hasMore so the frontend can render the See More control.
     *
     * @param requestedLocation resolved location/scope string
     * @param requestedCountry  resolved country
     * @param page              0-indexed page number
     * @param size              page size
     * @return populated NewsFeedPage
     */
    private NewsFeedPage servePagedFromDb(String requestedLocation, String requestedCountry,
                                          int page, int size) {
        int currentYear = LocalDateTime.now().getYear();
        PageRequest pageRequest = PageRequest.of(page, size);
        long total;
        List<NewsArticle> articles;

        if (LOCATION_ALL.equalsIgnoreCase(requestedLocation)) {
            total = newsArticleRepository.countByYear(currentYear);
            articles = newsArticleRepository.findAllByYear(currentYear, pageRequest);
        } else if (LOCATION_NATIONAL.equalsIgnoreCase(requestedLocation)) {
            // BUG 2 FIX: findNationalNewsByYear now excludes articles with a non-null region
            // so city-specific Local articles never appear in the National feed.
            total = newsArticleRepository.countNationalNews(requestedCountry, currentYear);
            articles = newsArticleRepository.findNationalNewsByYear(requestedCountry, currentYear, pageRequest);
        } else if (LOCATION_INTERNATIONAL.equalsIgnoreCase(requestedLocation)) {
            // BUG 1 FIX: new 1-country signature — matches country='International' AND region=:domesticCountry
            // instead of the old NOT IN approach that pooled all users' International articles together.
            total = newsArticleRepository.countInternationalNews(requestedCountry, currentYear);
            articles = newsArticleRepository.findInternationalNewsByYear(requestedCountry, currentYear, pageRequest);
        } else {
            // Local / area scope — requestedLocation holds the resolved area string.
            // BUG 2+3 FIX: use renamed findLocalNewsByYear / countLocalNews which match
            // ONLY by region, eliminating the OR country=:country bleed-through.
            total = newsArticleRepository.countLocalNews(requestedLocation, currentYear);
            articles = newsArticleRepository.findLocalNewsByYear(requestedLocation, currentYear, pageRequest);
        }

        List<NewsFeedItem> items = articles.stream().map(this::toFeedItem).toList();
        boolean hasMore = (long) page * size + items.size() < total;
        return new NewsFeedPage(items, (int) total, hasMore);
    }

    /**
     * Returns the total count of current-year articles for the given scope
     * without loading any rows into memory.
     *
     * @param requestedLocation resolved location/scope string
     * @param requestedCountry  resolved country
     * @param currentYear       current calendar year
     * @return article count
     */
    private long countForScope(String requestedLocation, String requestedCountry, int currentYear) {
        if (LOCATION_ALL.equalsIgnoreCase(requestedLocation)) {
            return newsArticleRepository.countByYear(currentYear);
        }
        if (LOCATION_NATIONAL.equalsIgnoreCase(requestedLocation)) {
            // BUG 2 FIX: countNationalNews now excludes non-null region rows — consistent
            // with the updated findNationalNewsByYear used in servePagedFromDb.
            return newsArticleRepository.countNationalNews(requestedCountry, currentYear);
        }
        if (LOCATION_INTERNATIONAL.equalsIgnoreCase(requestedLocation)) {
            // BUG 1+3 FIX: use the new 1-country signature that matches on region=:domesticCountry
            // instead of NOT IN, consistent with servePagedFromDb's findInternationalNewsByYear.
            return newsArticleRepository.countInternationalNews(requestedCountry, currentYear);
        }
        // BUG 3 FIX: use countLocalNews (region-only) instead of countByRegion — now identical
        // to the count used in servePagedFromDb, eliminating the gate/pagination mismatch.
        return newsArticleRepository.countLocalNews(requestedLocation, currentYear);
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
