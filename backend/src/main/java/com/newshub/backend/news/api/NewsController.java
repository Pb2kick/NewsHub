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
     * Full-text search across persisted articles by keyword, scoped to the
     * user's current location context.
     *
     * Location params mirror those accepted by GET /api/news so the search
     * results respect whichever scope (Local / National / International) the
     * user has selected in the UI.
     *
     * Returns an empty JSON array when q is blank so the frontend can always
     * safely parse the response without special-casing error status codes.
     *
     * @param q        raw search query string
     * @param location scope mode: Local, National, or International
     * @param area     resolved area/region for the Local scope
     * @param country  resolved country for the National scope
     * @return up to 8 matching feed items ordered by publish date descending
     */
    @GetMapping("/search")
    public List<NewsFeedItem> searchNews(
            @RequestParam(required = false, defaultValue = "") String q,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) String area,
            @RequestParam(required = false) String country
    ) {
        if (q == null || q.isBlank()) {
            return List.of();
        }
        return newsService.searchNews(q, location, area, country);
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
