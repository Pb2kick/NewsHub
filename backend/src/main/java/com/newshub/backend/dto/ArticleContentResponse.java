package com.newshub.backend.dto;

public record ArticleContentResponse(
        String content,
        boolean extracted
) {
}
