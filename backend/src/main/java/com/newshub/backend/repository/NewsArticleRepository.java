package com.newshub.backend.repository;

import com.newshub.backend.entity.NewsArticle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface NewsArticleRepository extends JpaRepository<NewsArticle, Long> {

    /**
     * Returns all articles ordered by publish date and id descending.
     *
     * @return ordered news entities
     */
    List<NewsArticle> findAllByOrderByPublishedAtDescIdDesc();

    /**
     * Returns national-scope records for the selected country or legacy national tag.
     *
     * @param country selected country context
     * @param nationalCountry legacy national tag
     * @return national feed entities
     */
    @Query("""
            select n from NewsArticle n
            where lower(n.country) = lower(:country)
               or lower(n.country) = lower(:nationalCountry)
            order by n.publishedAt desc, n.id desc
            """)
    List<NewsArticle> findNationalNews(@Param("country") String country, @Param("nationalCountry") String nationalCountry);

    /**
     * Returns international records excluding selected domestic country and legacy national tag.
     *
     * @param nationalCountry legacy national tag
     * @param domesticCountry selected domestic country context
     * @return international feed entities
     */
    @Query("""
            select n from NewsArticle n
            where n.country is not null
                and lower(n.country) not in (lower(:nationalCountry), lower(:domesticCountry))
            order by n.publishedAt desc, n.id desc
            """)
    List<NewsArticle> findInternationalNews(@Param("nationalCountry") String nationalCountry, @Param("domesticCountry") String domesticCountry);

    /**
     * Returns local records scoped to selected area plus fallback national rows.
     *
     * @param nationalCountry legacy national tag
     * @param country selected country context
     * @param region selected area context
     * @return local feed entities
     */
    @Query("""
        select n from NewsArticle n
        where lower(n.country) = lower(:nationalCountry)
           or lower(n.country) = lower(:country)
           or lower(n.region) = lower(:region)
        order by n.publishedAt desc, n.id desc
        """)
    List<NewsArticle> findNationalAndRegion(@Param("nationalCountry") String nationalCountry, @Param("country") String country, @Param("region") String region);

    boolean existsByTitleIgnoreCaseAndSourceIgnoreCase(String title, String source);

    Optional<NewsArticle> findFirstByTitleIgnoreCaseAndSourceIgnoreCase(String title, String source);
}
