package com.newshub.backend.news.bootstrap;

import com.newshub.backend.news.application.NewsCategoryClassifier;
import com.newshub.backend.news.domain.NewsArticle;
import com.newshub.backend.news.infrastructure.persistence.NewsArticleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Startup upkeep that Hibernate's ddl-auto=update cannot do by itself.
 *
 * <ul>
 *   <li>Creates the GIN index behind full-text search. Its expression must match
 *       the one in {@code NewsArticleRepository.searchFullText} exactly, or
 *       PostgreSQL will not use it.</li>
 *   <li>Fills in the stored category for rows saved before the column existed,
 *       so database-side category filtering covers old articles too.</li>
 *   <li>Deletes the six made-up demo articles an old startup seeder inserted.</li>
 * </ul>
 * All steps are idempotent and failures are logged, never fatal.
 */
@Component
public class NewsSchemaMaintenance implements ApplicationRunner {

    static final String FULL_TEXT_INDEX_SQL = """
            CREATE INDEX IF NOT EXISTS news_fulltext_idx ON news USING GIN (
                to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(content, ''))
            )""";
    /**
     * Titles of the demo articles the removed NewsDataInitializer used to insert.
     * A row is deleted only when its title matches exactly and it has no source
     * link and no author, which is how the seeder saved them; real articles
     * always have a source link.
     */
    public static final List<String> DEMO_ARTICLE_TITLES = List.of(
            "National Election Commission Announces Updated 2026 Voting Timeline",
            "Government Expands SME Support Program for Urban Communities",
            "Digital ID Rollout Reaches 85% of Eligible Citizens",
            "New Cybersecurity Framework Introduced for Election Infrastructure",
            "Regional Transit Upgrade Targets Commute Delays",
            "Global Summit on Climate Action Reaches Historic Agreement");
    private static final String DEMO_ARTICLES_CLEANUP_SQL =
            "DELETE FROM news WHERE source_url IS NULL AND user_id IS NULL AND title IN (?, ?, ?, ?, ?, ?)";
    private static final int BATCH_SIZE = 200;
    private static final Logger LOG = LoggerFactory.getLogger(NewsSchemaMaintenance.class);

    private final NewsArticleRepository repository;
    private final JdbcTemplate jdbcTemplate;

    public NewsSchemaMaintenance(NewsArticleRepository repository, JdbcTemplate jdbcTemplate) {
        this.repository = repository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        ensureFullTextIndex();
        removeDemoArticles();
        backfillCategories();
    }

    /**
     * Deletes the leftover demo articles. Does nothing once they are gone.
     *
     * @return number of rows deleted
     */
    public int removeDemoArticles() {
        try {
            int deleted = jdbcTemplate.update(DEMO_ARTICLES_CLEANUP_SQL, DEMO_ARTICLE_TITLES.toArray());
            if (deleted > 0) {
                LOG.info("Removed {} demo articles", deleted);
            }
            return deleted;
        } catch (Exception failure) {
            LOG.warn("Could not remove demo articles: {}", failure.getMessage());
            return 0;
        }
    }

    /** Creates the full-text index if it is missing. */
    public void ensureFullTextIndex() {
        try {
            jdbcTemplate.execute(FULL_TEXT_INDEX_SQL);
        } catch (Exception failure) {
            LOG.warn("Could not create full-text search index; search still works, only slower: {}", failure.getMessage());
        }
    }

    /**
     * Classifies every article that has no stored category yet.
     *
     * @return number of rows updated
     */
    public int backfillCategories() {
        int updated = 0;
        try {
            while (true) {
                List<NewsArticle> batch = repository.findByCategoryIsNull(PageRequest.of(0, BATCH_SIZE));
                if (batch.isEmpty()) {
                    break;
                }
                for (NewsArticle article : batch) {
                    article.setCategory(NewsCategoryClassifier.classify("", article.getTitle(),
                            article.getSummary(), article.getContent(), article.getSource()));
                }
                repository.saveAll(batch);
                updated += batch.size();
                if (batch.size() < BATCH_SIZE) {
                    break;
                }
            }
            if (updated > 0) {
                LOG.info("Stored categories for {} existing articles", updated);
            }
        } catch (Exception failure) {
            LOG.warn("Category backfill stopped after {} rows: {}", updated, failure.getMessage());
        }
        return updated;
    }
}
