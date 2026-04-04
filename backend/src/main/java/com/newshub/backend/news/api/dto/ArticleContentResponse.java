package com.newshub.backend.news.api.dto;

public record ArticleContentResponse(
        String content,
        boolean extracted
) {
}
