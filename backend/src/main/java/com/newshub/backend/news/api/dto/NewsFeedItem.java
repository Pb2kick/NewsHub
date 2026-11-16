package com.newshub.backend.news.api.dto;

public record NewsFeedItem(
        Long id,
        String location,
        String category,
        String title,
        String excerpt,
        String content,
        String author,
        String date,
        String readTime,
        String image,
        String sourceType,
        String sourceUrl,
        String publisherImage,
        /* ISO-8601 instant (e.g. 2026-11-16T08:30:00Z) so ordering keeps the time of day. */
        String publishedAt
) {
}
