package com.newshub.backend.news.infrastructure.persistence;

import com.newshub.backend.news.domain.NewsArticle;
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

    /**
     * Returns articles whose title, summary, or content contain the keyword phrase,
     * ordered by most recent first and capped at 8 results.
     *
     * @param keyword lower-cased search phrase wrapped with % wildcards by the caller
     * @return matching news entities
     */
    @Query("""
        select n from NewsArticle n
        where lower(n.title)   like concat('%', lower(:keyword), '%')
           or lower(n.summary) like concat('%', lower(:keyword), '%')
           or lower(n.content) like concat('%', lower(:keyword), '%')
        order by n.publishedAt desc, n.id desc
        """)
    List<NewsArticle> searchByKeyword(@Param("keyword") String keyword,
                                      org.springframework.data.domain.Pageable pageable);

    /**
     * Full-text keyword search filtered to a specific region/area (Local scope).
     * Matches articles whose title, summary, or content contain the keyword AND
     * whose region or country matches the requested area.
     *
     * @param keyword lower-cased search phrase
     * @param area    resolved area name (e.g. "Metro District", "New Orleans")
     * @param country domestic country context used as a fallback match
     * @return matching news entities ordered by most recent first
     */
    @Query("""
        select n from NewsArticle n
        where (
            lower(n.title)   like concat('%', lower(:keyword), '%')
         or lower(n.summary) like concat('%', lower(:keyword), '%')
         or lower(n.content) like concat('%', lower(:keyword), '%')
        )
        and (
            lower(n.region)  = lower(:area)
         or lower(n.country) = lower(:country)
        )
        order by n.publishedAt desc, n.id desc
        """)
    List<NewsArticle> searchByKeywordAndArea(
            @Param("keyword") String keyword,
            @Param("area") String area,
            @Param("country") String country,
            org.springframework.data.domain.Pageable pageable);

    /**
     * Full-text keyword search filtered to the national scope.
     * Returns articles whose country matches the domestic country OR whose
     * country field equals the legacy "National" tag.
     *
     * @param keyword         lower-cased search phrase
     * @param country         domestic country context
     * @param nationalCountry legacy "National" tag
     * @return matching news entities ordered by most recent first
     */
    @Query("""
        select n from NewsArticle n
        where (
            lower(n.title)   like concat('%', lower(:keyword), '%')
         or lower(n.summary) like concat('%', lower(:keyword), '%')
         or lower(n.content) like concat('%', lower(:keyword), '%')
        )
        and (
            lower(n.country) = lower(:country)
         or lower(n.country) = lower(:nationalCountry)
        )
        order by n.publishedAt desc, n.id desc
        """)
    List<NewsArticle> searchByKeywordAndNational(
            @Param("keyword") String keyword,
            @Param("country") String country,
            @Param("nationalCountry") String nationalCountry,
            org.springframework.data.domain.Pageable pageable);

    /**
     * Full-text keyword search filtered to the international scope.
     * Excludes articles belonging to the domestic country or legacy national tag.
     *
     * @param keyword         lower-cased search phrase
     * @param nationalCountry legacy "National" tag to exclude
     * @param domesticCountry domestic country to exclude
     * @return matching news entities ordered by most recent first
     */
    @Query("""
        select n from NewsArticle n
        where (
            lower(n.title)   like concat('%', lower(:keyword), '%')
         or lower(n.summary) like concat('%', lower(:keyword), '%')
         or lower(n.content) like concat('%', lower(:keyword), '%')
        )
        and n.country is not null
        and lower(n.country) not in (lower(:nationalCountry), lower(:domesticCountry))
        order by n.publishedAt desc, n.id desc
        """)
    List<NewsArticle> searchByKeywordAndInternational(
            @Param("keyword") String keyword,
            @Param("nationalCountry") String nationalCountry,
            @Param("domesticCountry") String domesticCountry,
            org.springframework.data.domain.Pageable pageable);

    boolean existsByTitleIgnoreCaseAndSourceIgnoreCase(String title, String source);

    Optional<NewsArticle> findFirstByTitleIgnoreCaseAndSourceIgnoreCase(String title, String source);
}

