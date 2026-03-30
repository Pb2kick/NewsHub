package com.newshub.backend.dto;

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
        String publisherImage
) {
}
