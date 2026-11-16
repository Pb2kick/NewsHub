package com.newshub.backend.news.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "news")
public class NewsArticle {

        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        private Long id;

        @Column(nullable = false, length = 500)
        private String title;

        @Column(name = "summary", nullable = false, length = 2000)
        private String summary;

        @Column(name = "content", nullable = false, length = 8000)
        private String content;

        @Column(name = "media_urls", length = 1200)
        private String mediaUrls;

        @Column(name = "source", length = 255)
        private String source;

        @Column(name = "source_url", length = 1200)
        private String sourceUrl;

        @Column(name = "country", length = 120)
        private String country;

        @Column(name = "region", length = 120)
        private String region;

        @Column(name = "published_at", nullable = false)
        private LocalDateTime publishedAt;

        @Column(name = "user_id")
        private Long userId;

        /**
         * When the live feed last returned this article for its scope. Used to
         * decide whether a scope needs a refresh; publishedAt cannot be used for
         * that because it says nothing about when we last checked the feed.
         * Nullable so existing rows stay valid (Hibernate adds the column).
         */
        @Column(name = "fetched_at")
        private LocalDateTime fetchedAt;

        public NewsArticle() {
        }

        public NewsArticle(String title, String summary, String content, String mediaUrls, String source, String sourceUrl, String country, String region, LocalDateTime publishedAt, Long userId) {
                this.title = title;
                this.summary = summary;
                this.content = content;
                this.mediaUrls = mediaUrls;
                this.source = source;
                this.sourceUrl = sourceUrl;
                this.country = country;
                this.region = region;
                this.publishedAt = publishedAt;
                this.userId = userId;
        }

        public Long getId() {
                return id;
        }

        public void setId(Long id) {
                this.id = id;
        }

        public String getTitle() {
                return title;
        }

        public void setTitle(String title) {
                this.title = title;
        }

        public String getSummary() {
                return summary;
        }

        public void setSummary(String summary) {
                this.summary = summary;
        }

        public String getContent() {
                return content;
        }

        public void setContent(String content) {
                this.content = content;
        }

        public String getMediaUrls() {
                return mediaUrls;
        }

        public void setMediaUrls(String mediaUrls) {
                this.mediaUrls = mediaUrls;
        }

        public String getSource() {
                return source;
        }

        public void setSource(String source) {
                this.source = source;
        }

        public String getSourceUrl() {
                return sourceUrl;
        }

        public void setSourceUrl(String sourceUrl) {
                this.sourceUrl = sourceUrl;
        }

        public String getCountry() {
                return country;
        }

        public void setCountry(String country) {
                this.country = country;
        }

        public String getRegion() {
                return region;
        }

        public void setRegion(String region) {
                this.region = region;
        }

        public LocalDateTime getPublishedAt() {
                return publishedAt;
        }

        public void setPublishedAt(LocalDateTime publishedAt) {
                this.publishedAt = publishedAt;
        }

        public Long getUserId() {
                return userId;
        }

        public void setUserId(Long userId) {
                this.userId = userId;
        }

        public LocalDateTime getFetchedAt() {
                return fetchedAt;
        }

        public void setFetchedAt(LocalDateTime fetchedAt) {
                this.fetchedAt = fetchedAt;
        }
}
