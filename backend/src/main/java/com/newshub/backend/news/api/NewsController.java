package com.newshub.backend.news.api;

import com.newshub.backend.news.api.dto.ArticleContentResponse;
import com.newshub.backend.news.api.dto.NewsFeedItem;
import com.newshub.backend.news.api.dto.NewsFeedPage;
import com.newshub.backend.news.application.ExternalNewsService;
import com.newshub.backend.news.application.NewsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
     * @param lat      optional latitude for local scope
     * @param lng      optional longitude for local scope
     * @param country  optional country context from user location changer
     * @param area     optional area context from user location changer
     * @param page     0-indexed page number (default 0)
     * @param size     page size — number of articles per page (default 4)
     * @return paginated feed page
     */
    @GetMapping
    public NewsFeedPage getNews(
            @RequestParam(required = false) String location,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng,
            @RequestParam(required = false) String country,
            @RequestParam(required = false) String area,
            @RequestParam(required = false) String region,
            @RequestParam(required = false) String countryCode,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Integer offset,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "4") int size
    ) {
        // offset (when given) wins over page: the home feed loads 5 first, then 4 at a time.
        return newsService.getNews(location, lat, lng, country, area, region, countryCode, category, offset, page, size);
    }

    /**
     * Ranked full-text search across all stored articles. Words may appear in any
     * order and the last word matches as a prefix. Results from the caller's
     * area, then country, rank first.
     *
     * Returns an empty JSON array when q has no searchable words so the frontend
     * can always parse the response.
     *
     * @param q           search text
     * @param location    ignored (kept for older clients); ranking uses area/region/country
     * @param area        caller's city, ranked first
     * @param region      caller's province/state (forms the Local scope key with area)
     * @param country     caller's country, ranked second
     * @param countryCode market for the live fallback
     * @param page        0-based page
     * @param size        results per page (default 8, max 50)
     * @param live        true for explicit searches (results page): when few stored
     *                    articles match, also search the live news source
     * @return matching feed items, best first
     */
    @GetMapping("/search")
    public List<NewsFeedItem> searchNews(
            @RequestParam(required = false, defaultValue = "") String q,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) String area,
            @RequestParam(required = false) String region,
            @RequestParam(required = false) String country,
            @RequestParam(required = false) String countryCode,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "8") int size,
            @RequestParam(defaultValue = "false") boolean live
    ) {
        if (q == null || q.isBlank()) {
            return List.of();
        }
        return newsService.searchNews(q, area, region, country, countryCode, page, size, live);
    }

    /**
     * Returns one persisted article by id, independent of the caller's location.
     * Used when an article link is opened directly (page refresh, shared link,
     * notification) and the article is not in the current feed page.
     *
     * @param id article id (digits only, so /search, /content and /image-proxy never match)
     * @return the article, or 404 when it does not exist
     */
    @GetMapping("/{id:\\d+}")
    public ResponseEntity<NewsFeedItem> getArticleById(@PathVariable long id) {
        return newsService.getArticleById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
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
