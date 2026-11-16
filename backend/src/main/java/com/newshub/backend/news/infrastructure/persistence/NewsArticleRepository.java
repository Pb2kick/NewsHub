package com.newshub.backend.news.infrastructure.persistence;

import com.newshub.backend.news.domain.NewsArticle;
import org.springframework.data.domain.Pageable;
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
     * @deprecated Use {@link #findInternationalNewsByYear} for paged access with correct country-scoping.
     */
    @Deprecated
    @Query("""
            select n from NewsArticle n
            where n.country is not null
                and lower(n.country) not in (lower(:nationalCountry), lower(:domesticCountry))
            order by n.publishedAt desc, n.id desc
            """)
    List<NewsArticle> findInternationalNews(@Param("nationalCountry") String nationalCountry, @Param("domesticCountry") String domesticCountry);

    /**
     * Returns local records scoped to selected area.
     *
     * @param nationalCountry legacy national tag (unused in query — retained for signature compat)
     * @param country selected country context (unused in query — retained for signature compat)
     * @param region selected area context
     * @return local feed entities
     * @deprecated Use {@link #findLocalNewsByYear} which is region-only and avoids National bleed-through.
     */
    @Deprecated
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
        where lower(n.title)   like concat('%', lower(:keyword), '%') escape '\\'
           or lower(n.summary) like concat('%', lower(:keyword), '%') escape '\\'
           or lower(n.content) like concat('%', lower(:keyword), '%') escape '\\'
        order by n.publishedAt desc, n.id desc
        """)
    List<NewsArticle> searchByKeyword(@Param("keyword") String keyword,
                                      org.springframework.data.domain.Pageable pageable);

    /**
     * Full-text keyword search filtered to a specific region/area (Local scope).
     * Matches articles whose title, summary, or content contain the keyword AND
     * whose region matches the requested area (region-only — no country fallback).
     *
     * BUG 2 FIX: removed "or lower(n.country) = lower(:country)" branch which caused
     * every National article for the user's domestic country to appear in Local search.
     * Local search must match region only so city-specific results are not contaminated.
     *
     * @param keyword lower-cased search phrase
     * @param area    resolved area name (e.g. "New Orleans")
     * @return matching news entities ordered by most recent first
     */
    @Query("""
        select n from NewsArticle n
        where (
            lower(n.title)   like concat('%', lower(:keyword), '%') escape '\\'
         or lower(n.summary) like concat('%', lower(:keyword), '%') escape '\\'
         or lower(n.content) like concat('%', lower(:keyword), '%') escape '\\'
        )
        and lower(n.region) = lower(:area)
        and lower(n.country) <> 'international'
        order by n.publishedAt desc, n.id desc
        """)
    List<NewsArticle> searchByKeywordAndArea(
            @Param("keyword") String keyword,
            @Param("area") String area,
            org.springframework.data.domain.Pageable pageable);

    /**
     * Full-text keyword search filtered to the national scope.
     * Returns articles whose country matches the domestic country.
     *
     * @param keyword lower-cased search phrase
     * @param country domestic country context
     * @return matching news entities ordered by most recent first
     */
    @Query("""
        select n from NewsArticle n
        where (
            lower(n.title)   like concat('%', lower(:keyword), '%') escape '\\'
         or lower(n.summary) like concat('%', lower(:keyword), '%') escape '\\'
         or lower(n.content) like concat('%', lower(:keyword), '%') escape '\\'
        )
        and lower(n.country) = lower(:country)
        and (n.region is null or n.region = '')
        order by n.publishedAt desc, n.id desc
        """)
    List<NewsArticle> searchByKeywordAndNational(
            @Param("keyword") String keyword,
            @Param("country") String country,
            org.springframework.data.domain.Pageable pageable);

    /**
     * Full-text keyword search filtered to the international scope.
     * Matches articles where country='International' AND region equals the user's domestic country.
     *
     * BUG 1 FIX: replaced the NOT IN approach with a positive match on country='international'
     * AND region=:domesticCountry. This ensures only the requesting user's International
     * articles are returned, not every other user's International pool.
     *
     * @param keyword         lower-cased search phrase
     * @param domesticCountry user's domestic country stored in region column
     * @return matching news entities ordered by most recent first
     */
    @Query("""
        select n from NewsArticle n
        where (
            lower(n.title)   like concat('%', lower(:keyword), '%') escape '\\'
         or lower(n.summary) like concat('%', lower(:keyword), '%') escape '\\'
         or lower(n.content) like concat('%', lower(:keyword), '%') escape '\\'
        )
        and lower(n.country) = 'international'
        and lower(n.region)  = lower(:domesticCountry)
        order by n.publishedAt desc, n.id desc
        """)
    List<NewsArticle> searchByKeywordAndInternational(
            @Param("keyword") String keyword,
            @Param("domesticCountry") String domesticCountry,
            org.springframework.data.domain.Pageable pageable);

    boolean existsByTitleIgnoreCaseAndSourceIgnoreCase(String title, String source);

    Optional<NewsArticle> findFirstByTitleIgnoreCaseAndSourceIgnoreCase(String title, String source);

    /**
     * Scope-aware duplicate lookup for region-tagged rows (Local and International).
     * Deduplicating per scope lets the same story appear in, say, both the Local
     * and the National feed instead of belonging only to whichever scope saw it first.
     */
    Optional<NewsArticle> findFirstByTitleIgnoreCaseAndSourceIgnoreCaseAndCountryIgnoreCaseAndRegionIgnoreCase(
            String title, String source, String country, String region);

    /** Scope-aware duplicate lookup for rows without a region (National / All). */
    Optional<NewsArticle> findFirstByTitleIgnoreCaseAndSourceIgnoreCaseAndCountryIgnoreCaseAndRegionIsNull(
            String title, String source, String country);

    // ── Last successful live-feed refresh per scope (max fetched_at) ──

    @Query("select max(n.fetchedAt) from NewsArticle n where lower(n.region) = lower(:region) "
            + "and lower(n.country) <> 'international'")
    java.time.LocalDateTime findLastFetchedLocal(@Param("region") String region);

    @Query("select max(n.fetchedAt) from NewsArticle n where lower(n.country) = lower(:country) "
            + "and (n.region is null or n.region = '')")
    java.time.LocalDateTime findLastFetchedNational(@Param("country") String country);

    @Query("select max(n.fetchedAt) from NewsArticle n where lower(n.country) = 'international' "
            + "and lower(n.region) = lower(:domesticCountry)")
    java.time.LocalDateTime findLastFetchedInternational(@Param("domesticCountry") String domesticCountry);

    @Query("select max(n.fetchedAt) from NewsArticle n")
    java.time.LocalDateTime findLastFetchedAll();

    // ── Paged feed queries (year-filtered so pagination counts are consistent) ──

    /** All-scope paged fetch, current year only. */
    @Query("""
            select n from NewsArticle n
            where year(n.publishedAt) = :year
            order by n.publishedAt desc, n.id desc
            """)
    List<NewsArticle> findAllByYear(@Param("year") int year, Pageable pageable);

    /** Total current-year article count across all scopes. */
    @Query("select count(n) from NewsArticle n where year(n.publishedAt) = :year")
    long countByYear(@Param("year") int year);

    /** National-scope paged fetch, current year only.
     * BUG 2 FIX: added (n.region IS NULL OR n.region = '') so Local articles
     * (which carry a non-null region value) never bleed into the National feed. */
    @Query("""
            select n from NewsArticle n
            where lower(n.country) = lower(:country)
              and (n.region is null or n.region = '')
              and year(n.publishedAt) = :year
            order by n.publishedAt desc, n.id desc
            """)
    List<NewsArticle> findNationalNewsByYear(
            @Param("country") String country,
            @Param("year") int year,
            Pageable pageable);

    /** Count for national scope.
     * BUG 2 FIX: same region IS NULL guard as findNationalNewsByYear. */
    @Query("""
            select count(n) from NewsArticle n
            where lower(n.country) = lower(:country)
              and (n.region is null or n.region = '')
              and year(n.publishedAt) = :year
            """)
    long countNationalNews(
            @Param("country") String country,
            @Param("year") int year);

    /** International-scope paged fetch, current year only.
     * BUG 1 FIX: replaced NOT IN (nationalCountry, domesticCountry) with a
     * positive match: country='international' AND region=:domesticCountry.
     * This scopes International articles per-user via the region column without
     * adding a new DB column (domestic country stored in region at persist time). */
    @Query("""
            select n from NewsArticle n
            where lower(n.country) = 'international'
              and lower(n.region)  = lower(:domesticCountry)
              and year(n.publishedAt) = :year
            order by n.publishedAt desc, n.id desc
            """)
    List<NewsArticle> findInternationalNewsByYear(
            @Param("domesticCountry") String domesticCountry,
            @Param("year") int year,
            Pageable pageable);

    /** Count for international scope.
     * BUG 1 FIX: identical WHERE clause as findInternationalNewsByYear. */
    @Query("""
            select count(n) from NewsArticle n
            where lower(n.country) = 'international'
              and lower(n.region)  = lower(:domesticCountry)
              and year(n.publishedAt) = :year
            """)
    long countInternationalNews(
            @Param("domesticCountry") String domesticCountry,
            @Param("year") int year);

    /** Local/area-scope paged fetch, current year only.
     * BUG 2+3 FIX: renamed from findNationalAndRegionByYear; now matches ONLY by
     * region, dropping the OR country=:country and OR country=:nationalCountry branches
     * that caused every National article for the user's country to bleed into Local. */
    @Query("""
            select n from NewsArticle n
            where lower(n.region) = lower(:region)
              and lower(n.country) <> 'international'
              and year(n.publishedAt) = :year
            order by n.publishedAt desc, n.id desc
            """)
    List<NewsArticle> findLocalNewsByYear(
            @Param("region") String region,
            @Param("year") int year,
            Pageable pageable);

        /** Count for local/area scope — region only.
         * BUG 2+3 FIX: renamed from countNationalAndRegion; consistent with findLocalNewsByYear. */
    @Query("""
            select count(n) from NewsArticle n
            where lower(n.region) = lower(:region)
              and lower(n.country) <> 'international'
              and year(n.publishedAt) = :year
            """)
    long countLocalNews(
            @Param("region") String region,
            @Param("year") int year);

    /**
     * @deprecated Superseded by {@link #findLocalNewsByYear} (region-only).
     * Retained for any legacy call sites; not called by NewsService.
     */
    @Deprecated
    @Query("""
            select n from NewsArticle n
            where (lower(n.country) = lower(:nationalCountry)
               or lower(n.country) = lower(:country)
               or lower(n.region)  = lower(:region))
              and year(n.publishedAt) = :year
            order by n.publishedAt desc, n.id desc
            """)
    List<NewsArticle> findNationalAndRegionByYear(
            @Param("nationalCountry") String nationalCountry,
            @Param("country") String country,
            @Param("region") String region,
            @Param("year") int year,
            Pageable pageable);

    /**
     * @deprecated Superseded by {@link #countLocalNews} (region-only).
     * Retained for any legacy call sites; not called by NewsService.
     */
    @Deprecated
    @Query("""
            select count(n) from NewsArticle n
            where (lower(n.country) = lower(:nationalCountry)
               or lower(n.country) = lower(:country)
               or lower(n.region)  = lower(:region))
              and year(n.publishedAt) = :year
            """)
    long countNationalAndRegion(
            @Param("nationalCountry") String nationalCountry,
            @Param("country") String country,
            @Param("region") String region,
            @Param("year") int year);

        /** Count for local scope (region only). */
    @Query("""
            select count(n) from NewsArticle n
            where lower(n.region) = lower(:region)
              and lower(n.country) <> 'international'
              and year(n.publishedAt) = :year
            """)
    long countByRegion(
            @Param("region") String region,
            @Param("year") int year);
}

