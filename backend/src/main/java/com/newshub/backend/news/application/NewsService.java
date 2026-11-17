package com.newshub.backend.news.application;

import com.newshub.backend.news.api.dto.NewsFeedItem;
import com.newshub.backend.news.api.dto.NewsFeedPage;
import com.newshub.backend.news.domain.NewsArticle;
import com.newshub.backend.news.infrastructure.persistence.NewsArticleRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class NewsService {

    private static final String LOCATION_ALL = "All";
    private static final String LOCATION_NATIONAL = "National";
    private static final String LOCATION_LOCAL = "Local";
    private static final String LOCATION_INTERNATIONAL = "International";
    /** Pool for articles found by live search; stored with country "Search", region = user's country. */
    private static final String LOCATION_SEARCH = "Search";
    /** Explicit searches with fewer stored matches than this also query the live source. */
    static final int LIVE_SEARCH_THRESHOLD = 3;

    private static final DateTimeFormatter FEED_DATE_FORMATTER = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.ENGLISH);
    private static final String LEGACY_STATIC_IMAGE = "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80";
    /** Minimum gap between live-fetch attempts for one scope, even when the attempt found nothing. */
    private static final Duration MIN_REFRESH_ATTEMPT_GAP = Duration.ofMinutes(15);

    private final NewsArticleRepository newsArticleRepository;
    private final ExternalNewsService externalNewsService;
    private final long staleHours;
    /** scope key → last live-fetch attempt; stops repeated fetches while Bing returns nothing new. */
    private final Map<String, Instant> lastRefreshAttempt = new ConcurrentHashMap<>();
    /** scope key → monitor serializing that scope's live refresh. */
    private final Map<String, Object> refreshLocks = new ConcurrentHashMap<>();

    public NewsService(NewsArticleRepository newsArticleRepository, ExternalNewsService externalNewsService,
                       @Value("${news.external.stale-hours:6}") long staleHours) {
        this.newsArticleRepository = newsArticleRepository;
        this.externalNewsService = externalNewsService;
        this.staleHours = staleHours;
    }

    /**
     * Returns location-aware news using a DB-first strategy.
     *
     * <p>Only the first page may trigger a live fetch, and only when the scope is
     * empty or its last successful fetch is older than {@code staleHours}. Later
     * pages always read the DB as-is so "See More" never waits on Bing and offsets
     * do not shift underneath the user mid-scroll.
     */
    public NewsFeedPage getNews(String location, Double latitude, Double longitude,
                                String country, String area, int page, int size) {
        return getNews(location, latitude, longitude, country, area, null, null, page, size);
    }

    /**
     * @param region      province/state of the area; combined with the area into the Local
     *                    scope key ("Naga, Cebu") so same-name places get separate feeds
     * @param countryCode ISO alpha-2 code, passed to the live feed as its market
     */
    public NewsFeedPage getNews(String location, Double latitude, Double longitude,
                                String country, String area, String region, String countryCode,
                                int page, int size) {
        return getNews(location, latitude, longitude, country, area, region, countryCode, null, page, size);
    }

    /**
     * @param category homepage tab to filter by in the database ("Politics", "Economy",
     *                 "Technology", "Elections"); null, blank or "Top Stories" means all
     */
    public NewsFeedPage getNews(String location, Double latitude, Double longitude,
                                String country, String area, String region, String countryCode,
                                String category, int page, int size) {
        String requestedCountry = normalizeCountry(country);
        String requestedLocation = normalizeLocation(location, localScopeKey(area, region));
        boolean isLocal = isLocalMode(location);
        int currentYear = LocalDateTime.now().getYear();

        if (requestedCountry.isBlank() || requestedLocation.isBlank()) {
            return new NewsFeedPage(List.of(), 0, false);
        }

        if (page == 0) {
            // One refresh per scope at a time: a second request for the same scope waits here
            // for the first one's fetch instead of skipping it (the attempt is already recorded)
            // and returning an empty page while the first request is still saving articles.
            Object scopeLock = refreshLocks.computeIfAbsent(scopeKey(requestedLocation, requestedCountry), key -> new Object());
            synchronized (scopeLock) {
                if (needsRefresh(requestedLocation, requestedCountry, currentYear)) {
                    lastRefreshAttempt.put(scopeKey(requestedLocation, requestedCountry), Instant.now());
                    List<NewsFeedItem> liveNews = externalNewsService.fetchLiveNews(requestedLocation, requestedCountry,
                            isLocal ? trimToNull(area) : null, isLocal ? trimToNull(region) : null, trimToNull(countryCode));
                    if (!liveNews.isEmpty()) {
                        persistExternalNews(liveNews, requestedLocation, requestedCountry);
                    }
                }
            }
        }

        return servePagedFromDb(requestedLocation, requestedCountry, normalizeCategory(category), page, size);
    }

    /**
     * Maps a requested tab to a stored category value, or "" for "everything".
     * Unknown values also mean everything rather than an always-empty feed.
     */
    static String normalizeCategory(String category) {
        if (category == null) {
            return "";
        }
        for (String known : List.of(NewsCategoryClassifier.POLITICS, NewsCategoryClassifier.ECONOMY,
                NewsCategoryClassifier.TECHNOLOGY, NewsCategoryClassifier.ELECTIONS)) {
            if (known.equalsIgnoreCase(category.trim())) {
                return known;
            }
        }
        return "";
    }

    /**
     * Returns a single persisted article regardless of scope, for article links
     * opened directly (refresh, shared link, notification).
     */
    public Optional<NewsFeedItem> getArticleById(long id) {
        return newsArticleRepository.findById(id).map(this::toFeedItem);
    }

    /** Dropdown search (first 8 results, no live fetch). */
    public List<NewsFeedItem> searchNews(String query, String location, String area, String country) {
        return searchNews(query, area, null, country, null, 0, 8, false);
    }

    /** Dropdown search (first 8 results, no live fetch), boosted toward "area, region". */
    public List<NewsFeedItem> searchNews(String query, String location, String area, String region, String country) {
        return searchNews(query, area, region, country, null, 0, 8, false);
    }

    /**
     * Ranked full-text search across every stored article.
     *
     * <p>Words can appear in any order and the last word matches as a prefix
     * ("cruise ship crash" finds "tanker crash into cruise ship"; "cruis" finds
     * "cruise"). Results from the user's own area come first, then their country,
     * then their International pool, then everything else.
     *
     * <p>With {@code live} set (explicit searches only, never per keystroke) and
     * fewer than {@value #LIVE_SEARCH_THRESHOLD} stored matches, the query is also
     * run against the live news source. Those articles are stored in a separate
     * "Search" pool that feeds never read, so search can grow the archive without
     * putting unrelated stories into anyone's Local or National feed.
     *
     * @param page 0-based page; live fetching only happens on page 0
     * @param size results per page, capped at 50
     */
    public List<NewsFeedItem> searchNews(String query, String area, String region, String country,
                                         String countryCode, int page, int size, boolean live) {
        String tsquery = buildTsQuery(query);
        if (tsquery.isEmpty()) {
            return List.of();
        }
        int safeSize = Math.max(1, Math.min(size, 50));
        int safePage = Math.max(0, page);
        String localKey = localScopeKey(area, region);
        String userCountry = normalizeCountry(country);

        List<NewsArticle> rows = newsArticleRepository.searchFullText(tsquery, localKey, userCountry, safeSize, safePage * safeSize);
        if (live && safePage == 0 && rows.size() < LIVE_SEARCH_THRESHOLD && query.trim().length() >= 3) {
            List<NewsFeedItem> liveItems = externalNewsService.searchLive(query.trim(), trimToNull(countryCode));
            if (!liveItems.isEmpty()) {
                persistExternalNews(liveItems, LOCATION_SEARCH, userCountry);
                rows = newsArticleRepository.searchFullText(tsquery, localKey, userCountry, safeSize, 0);
            }
        }
        return rows.stream().map(this::toFeedItem).toList();
    }

    /**
     * Builds a PostgreSQL tsquery from free text: words are reduced to letters and
     * digits (so user input can never inject tsquery operators), joined with AND,
     * and the last word gets a prefix marker for search-as-you-type.
     * "Cruise ship cras" becomes "cruise & ship & cras:*".
     *
     * @return the tsquery, or "" when the text has no searchable words
     */
    static String buildTsQuery(String raw) {
        if (raw == null) {
            return "";
        }
        List<String> words = java.util.Arrays.stream(raw.toLowerCase(Locale.ROOT).split("[^\\p{L}\\p{N}]+"))
                .filter(word -> !word.isBlank())
                .limit(8)
                .toList();
        if (words.isEmpty()) {
            return "";
        }
        List<String> terms = new java.util.ArrayList<>(words);
        terms.set(terms.size() - 1, terms.get(terms.size() - 1) + ":*");
        return String.join(" & ", terms);
    }

    /**
     * Escapes LIKE metacharacters so a user typing "%" or "_" searches for that
     * character instead of matching every row. Paired with {@code escape '\'} in the queries.
     */
    static String escapeLikePattern(String raw) {
        return raw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    /**
     * Resolves the lookup location: the scope name for National/International/All,
     * or the area name for Local. A Local request without an area resolves to ""
     * (empty feed) — the old coordinate fallback invented Philippine placeholder
     * regions such as "North Province" for any coordinates.
     */
    private String normalizeLocation(String location, String area) {
        String trimmedArea = area == null ? "" : area.trim();
        if (location == null || location.isBlank() || LOCATION_LOCAL.equalsIgnoreCase(location)) {
            return trimmedArea;
        }
        return location.trim();
    }

    /**
     * Local scope key stored in the region column: "Area, Region" when the
     * province/state is known ("Naga, Cebu" vs. "Naga, Bicol Region"), otherwise
     * just the area (locations saved before regions existed).
     */
    static String localScopeKey(String area, String region) {
        String cleanArea = trimToNull(area);
        String cleanRegion = trimToNull(region);
        if (cleanArea == null) {
            return "";
        }
        if (cleanRegion == null || cleanRegion.equalsIgnoreCase(cleanArea)) {
            return cleanArea;
        }
        return cleanArea + ", " + cleanRegion;
    }

    private static boolean isLocalMode(String location) {
        return location == null || location.isBlank() || LOCATION_LOCAL.equalsIgnoreCase(location);
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String normalizeCountry(String country) {
        return country == null || country.isBlank() ? "" : country.trim();
    }

    /**
     * A scope needs a live fetch when it has no current-year articles, or when its
     * last successful fetch (max fetched_at) is older than staleHours. Attempts are
     * throttled per scope so a feed that keeps returning nothing new is not
     * re-fetched on every request.
     */
    private boolean needsRefresh(String requestedLocation, String requestedCountry, int currentYear) {
        Instant lastAttempt = lastRefreshAttempt.get(scopeKey(requestedLocation, requestedCountry));
        if (lastAttempt != null && Duration.between(lastAttempt, Instant.now()).compareTo(MIN_REFRESH_ATTEMPT_GAP) < 0) {
            return false;
        }
        if (countForScope(requestedLocation, requestedCountry, currentYear) == 0) {
            return true;
        }
        LocalDateTime lastFetched = lastFetchedForScope(requestedLocation, requestedCountry);
        if (lastFetched == null) {
            return true; // rows predate fetched_at tracking
        }
        return Duration.between(lastFetched, nowUtc()).toHours() >= staleHours;
    }

    private LocalDateTime lastFetchedForScope(String requestedLocation, String requestedCountry) {
        if (LOCATION_ALL.equalsIgnoreCase(requestedLocation)) {
            return newsArticleRepository.findLastFetchedAll();
        }
        if (LOCATION_NATIONAL.equalsIgnoreCase(requestedLocation)) {
            return newsArticleRepository.findLastFetchedNational(requestedCountry);
        }
        if (LOCATION_INTERNATIONAL.equalsIgnoreCase(requestedLocation)) {
            return newsArticleRepository.findLastFetchedInternational(requestedCountry);
        }
        return newsArticleRepository.findLastFetchedLocal(requestedLocation);
    }

    private String scopeKey(String requestedLocation, String requestedCountry) {
        return requestedLocation.toLowerCase(Locale.ROOT) + "|" + requestedCountry.toLowerCase(Locale.ROOT);
    }

    private NewsFeedItem toFeedItem(NewsArticle article) {
        String effectiveLocation = firstNonBlank(article.getRegion(), article.getCountry(), LOCATION_NATIONAL);
        String excerpt = firstNonBlank(article.getSummary(), truncate(article.getContent(), 180), "No summary available.");
        String author = firstNonBlank(article.getSource(), "NewsHub Desk");
        String category = firstNonBlank(article.getCategory(), classify(article));
        String image = sanitizeImageUrl(article.getMediaUrls());
        String date = article.getPublishedAt() != null
                ? FEED_DATE_FORMATTER.format(article.getPublishedAt())
                : "Unknown date";
        String publishedAtIso = article.getPublishedAt() != null
                ? article.getPublishedAt().toInstant(ZoneOffset.UTC).toString()
                : null;

        return new NewsFeedItem(
                article.getId(),
                effectiveLocation,
                category,
                article.getTitle(),
                excerpt,
                firstNonBlank(article.getContent(), excerpt),
                author,
                date,
                estimateReadTime(article.getContent()),
                image,
                "DATABASE",
                article.getSourceUrl(),
                null,
                publishedAtIso
        );
    }

    /**
     * Stores fresh live items for one scope. Duplicates are checked within the
     * same scope (title + source + country + region), so a story can live in
     * both the Local and the National feed. Every item the feed returned gets
     * fetched_at = now, which is what marks the scope as fresh.
     */
    private void persistExternalNews(List<NewsFeedItem> liveNews, String requestedLocation, String requestedCountry) {
        String country = resolveCountryForLocation(requestedLocation, requestedCountry);
        String region = resolveRegionForLocation(requestedLocation, requestedCountry);
        LocalDateTime fetchedAt = nowUtc();
        Set<String> seenInBatch = new HashSet<>();

        List<NewsArticle> toSave = liveNews.stream()
                .filter(item -> item.title() != null && !item.title().isBlank())
                .filter(item -> seenInBatch.add((item.title() + "|" + item.author()).toLowerCase(Locale.ROOT)))
                .map(item -> {
                    String normalizedImage = sanitizeImageUrl(item.image());
                    NewsArticle existing = findExistingInScope(item.title(), item.author(), country, region).orElse(null);
                    if (existing != null) {
                        existing.setFetchedAt(fetchedAt);
                        if (existing.getCategory() == null || existing.getCategory().isBlank()) {
                            existing.setCategory(classify(existing));
                        }
                        if (sanitizeImageUrl(existing.getMediaUrls()).isBlank() && !normalizedImage.isBlank()) {
                            existing.setMediaUrls(normalizedImage);
                        }
                        return existing;
                    }
                    NewsArticle created = new NewsArticle(
                            item.title(),
                            item.excerpt(),
                            firstNonBlank(item.content(), item.excerpt()),
                            normalizedImage,
                            item.author(),
                            item.sourceUrl(),
                            country,
                            region,
                            parsePublishedAt(item),
                            null
                    );
                    created.setFetchedAt(fetchedAt);
                    created.setCategory(classify(created));
                    return created;
                })
                .filter(Objects::nonNull)
                .toList();

        if (!toSave.isEmpty()) {
            newsArticleRepository.saveAll(toSave);
        }
    }

    private static String classify(NewsArticle article) {
        return NewsCategoryClassifier.classify("", article.getTitle(), article.getSummary(),
                article.getContent(), article.getSource());
    }

    private Optional<NewsArticle> findExistingInScope(String title, String source, String country, String region) {
        String safeSource = source == null ? "" : source;
        if (region == null) {
            return newsArticleRepository
                    .findFirstByTitleIgnoreCaseAndSourceIgnoreCaseAndCountryIgnoreCaseAndRegionIsNull(title, safeSource, country);
        }
        return newsArticleRepository
                .findFirstByTitleIgnoreCaseAndSourceIgnoreCaseAndCountryIgnoreCaseAndRegionIgnoreCase(title, safeSource, country, region);
    }

    /**
     * Uses the exact ISO timestamp when the live item has one (keeps time of day
     * for ordering); falls back to the "MMM d, yyyy" display date, then to now.
     * Stored as UTC wall-clock time.
     */
    private LocalDateTime parsePublishedAt(NewsFeedItem item) {
        if (item.publishedAt() != null && !item.publishedAt().isBlank()) {
            try {
                return LocalDateTime.ofInstant(Instant.parse(item.publishedAt()), ZoneOffset.UTC);
            } catch (Exception ignored) {
                // fall through to the display date
            }
        }
        String feedDate = item.date();
        if (feedDate == null || feedDate.isBlank() || "Latest".equalsIgnoreCase(feedDate)) {
            return nowUtc();
        }
        try {
            return LocalDateTime.parse(feedDate + " 00:00", DateTimeFormatter.ofPattern("MMM d, yyyy HH:mm", Locale.ENGLISH));
        } catch (Exception ignored) {
            return nowUtc();
        }
    }

    private static LocalDateTime nowUtc() {
        return LocalDateTime.now(ZoneOffset.UTC);
    }

    private String resolveCountryForLocation(String requestedLocation, String requestedCountry) {
        if (LOCATION_INTERNATIONAL.equalsIgnoreCase(requestedLocation)) {
            return "International";
        }
        if (LOCATION_SEARCH.equalsIgnoreCase(requestedLocation)) {
            return LOCATION_SEARCH;
        }
        return requestedCountry;
    }

    /**
     * Region column: null for National/All, the area for Local, and the user's
     * domestic country for International and Search (so each country's pools
     * stay separate without a new column). Feed queries never read the Search pool.
     */
    private String resolveRegionForLocation(String requestedLocation, String requestedCountry) {
        if (LOCATION_INTERNATIONAL.equalsIgnoreCase(requestedLocation)
                || LOCATION_SEARCH.equalsIgnoreCase(requestedLocation)) {
            return requestedCountry == null || requestedCountry.isBlank() ? null : requestedCountry;
        }
        if (requestedLocation == null || requestedLocation.isBlank()
                || LOCATION_NATIONAL.equalsIgnoreCase(requestedLocation)
                || LOCATION_ALL.equalsIgnoreCase(requestedLocation)) {
            return null;
        }
        return requestedLocation;
    }

    private String estimateReadTime(String content) {
        if (content == null || content.isBlank()) {
            return "3 min read";
        }
        int words = content.trim().split("\\s+").length;
        int minutes = Math.max(1, (int) Math.ceil(words / 200.0));
        return minutes + " min read";
    }

    private String truncate(String text, int maxLength) {
        if (text == null || text.isBlank()) {
            return "";
        }
        if (text.length() <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength - 3) + "...";
    }

    private String sanitizeImageUrl(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            return "";
        }
        String normalized = imageUrl.trim();
        return LEGACY_STATIC_IMAGE.equals(normalized) ? "" : normalized;
    }

    /**
     * Serves one page of current-year articles from the DB for the given scope.
     */
    private NewsFeedPage servePagedFromDb(String requestedLocation, String requestedCountry, String category,
                                          int page, int size) {
        int currentYear = LocalDateTime.now().getYear();
        PageRequest pageRequest = PageRequest.of(page, size);
        long total;
        List<NewsArticle> articles;

        if (LOCATION_ALL.equalsIgnoreCase(requestedLocation)) {
            total = newsArticleRepository.countByYear(currentYear);
            articles = newsArticleRepository.findAllByYear(currentYear, pageRequest);
        } else if (LOCATION_NATIONAL.equalsIgnoreCase(requestedLocation)) {
            total = newsArticleRepository.countNationalNews(requestedCountry, currentYear, category);
            articles = newsArticleRepository.findNationalNewsByYear(requestedCountry, currentYear, category, pageRequest);
        } else if (LOCATION_INTERNATIONAL.equalsIgnoreCase(requestedLocation)) {
            total = newsArticleRepository.countInternationalNews(requestedCountry, currentYear, category);
            articles = newsArticleRepository.findInternationalNewsByYear(requestedCountry, currentYear, category, pageRequest);
        } else {
            total = newsArticleRepository.countLocalNews(requestedLocation, currentYear, category);
            articles = newsArticleRepository.findLocalNewsByYear(requestedLocation, currentYear, category, pageRequest);
        }

        List<NewsFeedItem> items = articles.stream().map(this::toFeedItem).toList();
        boolean hasMore = (long) page * size + items.size() < total;
        return new NewsFeedPage(items, (int) total, hasMore);
    }

    private long countForScope(String requestedLocation, String requestedCountry, int currentYear) {
        if (LOCATION_ALL.equalsIgnoreCase(requestedLocation)) {
            return newsArticleRepository.countByYear(currentYear);
        }
        if (LOCATION_NATIONAL.equalsIgnoreCase(requestedLocation)) {
            return newsArticleRepository.countNationalNews(requestedCountry, currentYear);
        }
        if (LOCATION_INTERNATIONAL.equalsIgnoreCase(requestedLocation)) {
            return newsArticleRepository.countInternationalNews(requestedCountry, currentYear);
        }
        return newsArticleRepository.countLocalNews(requestedLocation, currentYear);
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
    }
}
