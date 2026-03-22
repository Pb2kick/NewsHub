package com.newshub.backend.repository;

import com.newshub.backend.entity.NewsArticle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface NewsArticleRepository extends JpaRepository<NewsArticle, Long> {

    List<NewsArticle> findAllByOrderByPublishedAtDescIdDesc();

    @Query("select n from NewsArticle n where lower(n.country) = lower(:country) order by n.publishedAt desc, n.id desc")
    List<NewsArticle> findByCountryIgnoreCaseOrderByPublishedAtDescIdDesc(@Param("country") String country);

        @Query("""
                select n from NewsArticle n
                where n.country is not null
                    and lower(n.country) not in (lower(:nationalCountry), lower(:domesticCountry))
                order by n.publishedAt desc, n.id desc
                """)
        List<NewsArticle> findInternationalNews(@Param("nationalCountry") String nationalCountry, @Param("domesticCountry") String domesticCountry);

    @Query("""
        select n from NewsArticle n
        where lower(n.country) = lower(:nationalCountry)
           or lower(n.region) = lower(:region)
        order by n.publishedAt desc, n.id desc
        """)
    List<NewsArticle> findNationalAndRegion(@Param("nationalCountry") String nationalCountry, @Param("region") String region);

    boolean existsByTitleIgnoreCaseAndSourceIgnoreCase(String title, String source);

    Optional<NewsArticle> findFirstByTitleIgnoreCaseAndSourceIgnoreCase(String title, String source);
}
