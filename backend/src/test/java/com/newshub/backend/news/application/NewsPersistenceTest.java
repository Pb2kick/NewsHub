package com.newshub.backend.news.application;

import com.newshub.backend.news.api.dto.NewsFeedItem;
import com.newshub.backend.news.api.dto.NewsFeedPage;
import com.newshub.backend.news.bootstrap.NewsSchemaMaintenance;
import com.newshub.backend.news.domain.NewsArticle;
import com.newshub.backend.news.infrastructure.persistence.NewsArticleRepository;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Runs the news repository queries and NewsService refresh/persist logic
 * against a real (embedded) PostgreSQL, so JPQL such as {@code escape '\'}
 * and the scope filters are checked with production semantics.
 */
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({NewsService.class, NewsSchemaMaintenance.class})
class NewsPersistenceTest {

    private static final EmbeddedPostgres POSTGRES = startPostgres();
    private static final int YEAR = LocalDateTime.now(ZoneOffset.UTC).getYear();

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> POSTGRES.getJdbcUrl("postgres", "postgres"));
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "postgres");
    }

    @Autowired
    private NewsArticleRepository repository;

    @Autowired
    private NewsService newsService;

    @Autowired
    private NewsSchemaMaintenance schemaMaintenance;

    @MockitoBean
    private ExternalNewsService externalNewsService;

    @BeforeEach
    void clean() {
        repository.deleteAll();
        reset(externalNewsService);
    }

    @Test
    void searchTreatsPercentAndUnderscoreLiterally() {
        repository.save(article("Tanker hits cruise ship", "United States", "New Orleans"));
        repository.save(article("Turnout reached 100% in pilot precinct", "United States", "New Orleans"));

        assertEquals(1, search("%").size(), "a bare % matches only the headline containing a literal %, not every row");
        assertEquals(0, search("__").size(), "underscores must not act as wildcards");
        assertEquals(1, search("100%").size());
        assertEquals(1, search("cruise ship").size());
    }

    @Test
    void localFeedExcludesInternationalRowsThatShareTheRegionName() {
        repository.save(article("Singapore local story", "Singapore", "Singapore"));
        repository.save(article("World story for Singapore readers", "International", "Singapore"));

        assertEquals(1, repository.countLocalNews("Singapore", YEAR));
        assertEquals(1, repository.countInternationalNews("Singapore", YEAR));
    }

    @Test
    void sameStoryIsStoredSeparatelyPerScope() {
        when(externalNewsService.fetchLiveNews(anyString(), anyString(), any(), any(), any()))
                .thenReturn(List.of(liveItem("Port reopens after collision", "2026-11-16T15:30:00Z")));

        newsService.getNews("National", null, null, "United States", null, 0, 4);
        newsService.getNews("Local", null, null, "United States", "New Orleans", 0, 4);

        assertEquals(1, repository.countNationalNews("United States", YEAR));
        assertEquals(1, repository.countLocalNews("New Orleans", YEAR));
        NewsArticle local = repository.findLocalNewsByYear("New Orleans", YEAR, PageRequest.of(0, 1)).get(0);
        assertNotNull(local.getFetchedAt(), "fetched_at marks the scope as refreshed");
        assertEquals(15, local.getPublishedAt().getHour(), "time of day is kept, not truncated to midnight");
        assertEquals(30, local.getPublishedAt().getMinute());
    }

    @Test
    void refetchingTheSameStoryUpdatesInsteadOfDuplicating() {
        when(externalNewsService.fetchLiveNews(anyString(), anyString(), any(), any(), any()))
                .thenReturn(List.of(
                        liveItem("Port reopens after collision", "2026-11-16T15:30:00Z"),
                        liveItem("Port reopens after collision", "2026-11-16T15:30:00Z")));

        // Own scope: NewsService (a shared bean) remembers per-scope attempts across tests.
        newsService.getNews("Local", null, null, "United States", "Baton Rouge", 0, 4);

        assertEquals(1, repository.countLocalNews("Baton Rouge", YEAR), "duplicates within one batch are dropped");
        assertNotNull(repository.findLastFetchedLocal("Baton Rouge"));
    }

    @Test
    void attemptsAreThrottledAndLaterPagesNeverFetch() {
        when(externalNewsService.fetchLiveNews(anyString(), anyString(), any(), any(), any()))
                .thenReturn(List.of(liveItem("Story A", "2026-11-16T10:00:00Z")));

        newsService.getNews("National", null, null, "Philippines", null, 0, 4);
        newsService.getNews("National", null, null, "Philippines", null, 0, 4);
        newsService.getNews("National", null, null, "Philippines", null, 1, 4);

        verify(externalNewsService, times(1)).fetchLiveNews(eq("National"), eq("Philippines"), isNull(), isNull(), isNull());
    }

    @Test
    void localWithoutAreaReturnsNothingInsteadOfPlaceholderRegions() {
        NewsFeedPage page = newsService.getNews("Local", 14.6, 120.98, "Philippines", null, 0, 4);

        assertTrue(page.items().isEmpty());
        verify(externalNewsService, never()).fetchLiveNews(any(), any(), any(), any(), any());
    }

    @Test
    void sameNamePlacesInDifferentProvincesGetSeparateFeeds() {
        when(externalNewsService.fetchLiveNews(anyString(), anyString(), any(), any(), any()))
                .thenReturn(List.of(liveItem("Naga road project starts", "2026-11-16T08:00:00Z")));

        newsService.getNews("Local", null, null, "Philippines", "Naga", "Cebu", "PH", 0, 4);
        newsService.getNews("Local", null, null, "Philippines", "Naga", "Bicol Region", "PH", 0, 4);

        assertEquals(1, repository.countLocalNews("Naga, Cebu", YEAR));
        assertEquals(1, repository.countLocalNews("Naga, Bicol Region", YEAR));
        // The bare city and province reach the live feed separately, plus the market code.
        verify(externalNewsService).fetchLiveNews("Naga, Cebu", "Philippines", "Naga", "Cebu", "PH");
        assertEquals(1, newsService.searchNews("road", "Local", "Naga", "Cebu", "Philippines").size());
    }

    @Test
    void articleCanBeLoadedById() {
        NewsArticle saved = repository.save(article("Direct link story", "Philippines", "Manila"));

        assertEquals("Direct link story", newsService.getArticleById(saved.getId()).orElseThrow().title());
        assertTrue(newsService.getArticleById(saved.getId() + 999).isEmpty());
    }

    @Test
    void fullTextSearchIgnoresWordOrderAndMatchesPrefixes() {
        repository.save(article("Tanker crash into cruise ship on the Mississippi", "United States", "New Orleans"));

        assertEquals(1, newsService.searchNews("cruise ship crash", "New Orleans", null, "United States", null, 0, 8, false).size());
        assertEquals(1, newsService.searchNews("cruis", null, null, "", null, 0, 8, false).size(), "prefix while typing");
        assertEquals(0, newsService.searchNews("cruise ship volcano", null, null, "", null, 0, 8, false).size());
        assertTrue(newsService.searchNews("& | ! ( ) :*", null, null, "", null, 0, 8, false).isEmpty(),
                "tsquery operators in user input never reach PostgreSQL");
    }

    @Test
    void searchRanksTheUsersAreaThenCountryAndRemovesDuplicateCopies() {
        repository.save(article("Flood warning issued elsewhere", "Japan", "Osaka"));
        repository.save(article("Flood warning issued nationwide", "Philippines", null));
        repository.save(article("Flood warning issued for Palo", "Philippines", "Palo, Leyte"));
        repository.save(article("Flood warning issued for Palo", "Philippines", null)); // same story, National copy

        List<NewsFeedItem> results = newsService.searchNews("flood warning", "Palo", "Leyte", "Philippines", "PH", 0, 8, false);

        assertEquals(List.of("Flood warning issued for Palo", "Flood warning issued nationwide", "Flood warning issued elsewhere"),
                results.stream().map(NewsFeedItem::title).toList());
        assertEquals("Palo, Leyte", results.get(0).location(), "the best-placed copy is the one returned");
    }

    @Test
    void explicitSearchFallsBackToLiveResultsStoredOutsideTheFeeds() {
        when(externalNewsService.searchLive(anyString(), any()))
                .thenReturn(List.of(liveItem("Volcano alert raised near Albay", "2026-11-16T09:00:00Z")));

        assertTrue(newsService.searchNews("volcano alert", null, null, "Philippines", "PH", 0, 8, false).isEmpty());
        verify(externalNewsService, never()).searchLive(anyString(), any()); // typing never calls the live source

        List<NewsFeedItem> results = newsService.searchNews("volcano alert", null, null, "Philippines", "PH", 0, 8, true);

        assertEquals(1, results.size());
        verify(externalNewsService).searchLive("volcano alert", "PH");
        assertEquals(0, repository.countNationalNews("Philippines", YEAR), "search results never appear in feeds");
    }

    @Test
    void feedCanBeFilteredByStoredCategory() {
        NewsArticle economy = article("Inflation slows as peso strengthens", "Philippines", null);
        economy.setCategory("Economy");
        NewsArticle politics = article("Senate passes budget", "Philippines", null);
        politics.setCategory("Politics");
        repository.saveAll(List.of(economy, politics));
        when(externalNewsService.fetchLiveNews(anyString(), anyString(), any(), any(), any())).thenReturn(List.of());

        NewsFeedPage page = newsService.getNews("National", null, null, "Philippines", null, null, null, "Economy", 0, 10);

        assertEquals(List.of("Inflation slows as peso strengthens"), page.items().stream().map(NewsFeedItem::title).toList());
        assertEquals(1, page.totalCount());
    }

    @Test
    void startupMaintenanceBackfillsCategoriesAndCreatesTheIndex() {
        repository.save(article("Comelec opens voter registration for the elections", "Philippines", null));

        assertEquals(1, schemaMaintenance.backfillCategories());
        schemaMaintenance.ensureFullTextIndex(); // idempotent; must not throw on PostgreSQL

        assertEquals("Elections", repository.findAll().get(0).getCategory());
        assertEquals(0, schemaMaintenance.backfillCategories());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED) // threads must see each other's commits
    void concurrentFirstLoadsWaitForTheSameRefresh() throws Exception {
        when(externalNewsService.fetchLiveNews(anyString(), anyString(), any(), any(), any())).thenAnswer(call -> {
            Thread.sleep(400); // Bing is slow; the second request arrives meanwhile
            return List.of(liveItem("Tacloban port reopens", "2026-11-16T07:00:00Z"));
        });
        try {
            java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(2);
            java.util.concurrent.Callable<NewsFeedPage> load =
                    () -> newsService.getNews("Local", null, null, "Philippines", "Tacloban", "Leyte", "PH", 0, 4);
            java.util.concurrent.Future<NewsFeedPage> first = pool.submit(load);
            Thread.sleep(50);
            java.util.concurrent.Future<NewsFeedPage> second = pool.submit(load);

            assertEquals(1, first.get().items().size());
            assertEquals(1, second.get().items().size(), "the second request must not get an empty page");
            verify(externalNewsService, times(1)).fetchLiveNews(anyString(), anyString(), any(), any(), any());
            pool.shutdown();
        } finally {
            repository.deleteAll(); // committed outside the test transaction, so clean up explicitly
        }
    }

    @Test
    void feedLoadsFiveFirstThenFourByOffsetWithoutGapsOrRepeats() {
        LocalDateTime base = LocalDateTime.now(ZoneOffset.UTC).withSecond(0).withNano(0);
        for (int i = 0; i < 9; i++) {
            NewsArticle story = article("Cebu story " + i, "Philippines", "Cebu, Central Visayas");
            story.setPublishedAt(base.minusMinutes(i)); // story 0 is newest
            repository.save(story);
        }

        NewsFeedPage first = newsService.getNews("Local", null, null, "Philippines", "Cebu", "Central Visayas",
                "PH", null, 0, 0, 5);
        NewsFeedPage more = newsService.getNews("Local", null, null, "Philippines", "Cebu", "Central Visayas",
                "PH", null, 5, 0, 4);

        assertEquals(List.of("Cebu story 0", "Cebu story 1", "Cebu story 2", "Cebu story 3", "Cebu story 4"),
                first.items().stream().map(NewsFeedItem::title).toList(), "1 featured + a full 2x2 grid");
        assertTrue(first.hasMore());
        assertEquals(List.of("Cebu story 5", "Cebu story 6", "Cebu story 7", "Cebu story 8"),
                more.items().stream().map(NewsFeedItem::title).toList(), "next two full rows, no repeats");
        assertTrue(!more.hasMore());
        verify(externalNewsService, never()).fetchLiveNews(any(), any(), any(), any(), any());
    }

    private List<NewsArticle> search(String raw) {
        return repository.searchByKeywordAndArea(NewsService.escapeLikePattern(raw), "New Orleans", PageRequest.of(0, 8));
    }

    private static NewsArticle article(String title, String country, String region) {
        NewsArticle article = new NewsArticle(title, title + " summary", title + " content", "", "Test Wire",
                null, country, region, LocalDateTime.now(ZoneOffset.UTC).withSecond(0).withNano(0), null);
        article.setFetchedAt(LocalDateTime.now(ZoneOffset.UTC));
        return article;
    }

    private static NewsFeedItem liveItem(String title, String publishedAtIso) {
        String isoForCurrentYear = YEAR + publishedAtIso.substring(4);
        return new NewsFeedItem(1L, "x", "Top Stories", title, title + " summary", title + " content",
                "Test Wire", "Nov 16, " + YEAR, "3 min read", "", "EXTERNAL", "https://example.com/" + title.hashCode(),
                "", isoForCurrentYear);
    }

    private static EmbeddedPostgres startPostgres() {
        try {
            return EmbeddedPostgres.start();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
