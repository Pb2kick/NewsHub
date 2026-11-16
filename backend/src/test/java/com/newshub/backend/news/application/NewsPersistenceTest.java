package com.newshub.backend.news.application;

import com.newshub.backend.news.api.dto.NewsFeedItem;
import com.newshub.backend.news.api.dto.NewsFeedPage;
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

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
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
@Import(NewsService.class)
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
        when(externalNewsService.fetchLiveNews(anyString(), anyString()))
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
        when(externalNewsService.fetchLiveNews(anyString(), anyString()))
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
        when(externalNewsService.fetchLiveNews(anyString(), anyString()))
                .thenReturn(List.of(liveItem("Story A", "2026-11-16T10:00:00Z")));

        newsService.getNews("National", null, null, "Philippines", null, 0, 4);
        newsService.getNews("National", null, null, "Philippines", null, 0, 4);
        newsService.getNews("National", null, null, "Philippines", null, 1, 4);

        verify(externalNewsService, times(1)).fetchLiveNews("National", "Philippines");
    }

    @Test
    void localWithoutAreaReturnsNothingInsteadOfPlaceholderRegions() {
        NewsFeedPage page = newsService.getNews("Local", 14.6, 120.98, "Philippines", null, 0, 4);

        assertTrue(page.items().isEmpty());
        verify(externalNewsService, never()).fetchLiveNews(anyString(), anyString());
    }

    @Test
    void articleCanBeLoadedById() {
        NewsArticle saved = repository.save(article("Direct link story", "Philippines", "Manila"));

        assertEquals("Direct link story", newsService.getArticleById(saved.getId()).orElseThrow().title());
        assertTrue(newsService.getArticleById(saved.getId() + 999).isEmpty());
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
