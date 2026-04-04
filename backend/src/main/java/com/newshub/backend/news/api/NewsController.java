package com.newshub.backend.news.api;

import com.newshub.backend.news.api.dto.ArticleContentResponse;
import com.newshub.backend.news.api.dto.NewsFeedItem;
import com.newshub.backend.news.application.ExternalNewsService;
import com.newshub.backend.news.application.NewsService;
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

    /**
     * Returns location-aware news for selected scope and user base location.
     *
     * @param location scope filter such as Local, National, or International
     * @param lat optional latitude for local scope
     * @param lng optional longitude for local scope
     * @param country optional country context from user location changer
     * @param area optional area context from user location changer
     * @return filtered feed items
     */
    @GetMapping
        public List<NewsFeedItem> getNews(
            @RequestParam(required = false) String location,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng,
            @RequestParam(required = false) String country,
            @RequestParam(required = false) String area
    ) {
        return newsService.getNews(location, lat, lng, country, area);
    }

    /**
     * Extracts readable article content from a source URL.
     *
     * @param url source URL
     * @return extracted content payload
     */
    @GetMapping("/content")
    public ArticleContentResponse getArticleContent(@RequestParam String url) {
        String extractedContent = externalNewsService.extractArticleContent(url);
        return new ArticleContentResponse(extractedContent, !extractedContent.isBlank());
    }
}
