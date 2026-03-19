package com.newshub.backend.controller;

import com.newshub.backend.dto.ArticleContentResponse;
import com.newshub.backend.dto.NewsFeedItem;
import com.newshub.backend.service.ExternalNewsService;
import com.newshub.backend.service.NewsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/news")
public class NewsController {

    private final NewsService newsService;
    private final ExternalNewsService externalNewsService;

    public NewsController(NewsService newsService, ExternalNewsService externalNewsService) {
        this.newsService = newsService;
        this.externalNewsService = externalNewsService;
    }

    @GetMapping
        public List<NewsFeedItem> getNews(
            @RequestParam(required = false) String location,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng
    ) {
        return newsService.getNews(location, lat, lng);
    }

    @GetMapping("/content")
    public ArticleContentResponse getArticleContent(@RequestParam String url) {
        String extractedContent = externalNewsService.extractArticleContent(url);
        return new ArticleContentResponse(extractedContent, !extractedContent.isBlank());
    }
}
