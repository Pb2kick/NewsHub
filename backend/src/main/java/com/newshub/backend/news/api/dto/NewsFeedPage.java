package com.newshub.backend.news.api.dto;

import java.util.List;

/**
 * Paginated response envelope for the news feed endpoint.
 *
 * @param items      articles in the current page
 * @param totalCount total matching articles in the DB for the current scope and year
 * @param hasMore    true when further pages are available beyond the current one
 */
public record NewsFeedPage(List<NewsFeedItem> items, int totalCount, boolean hasMore) {}
