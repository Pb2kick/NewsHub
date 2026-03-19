package com.newshub.backend.service;

import com.newshub.backend.dto.NewsFeedItem;
import com.newshub.backend.entity.NewsArticle;
import com.newshub.backend.repository.NewsArticleRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Service
public class NewsService {

    private static final String LOCATION_ALL = "All";
    private static final String LOCATION_NATIONAL = "National";
    private static final String LOCATION_LOCAL = "Local";

    private static final DateTimeFormatter FEED_DATE_FORMATTER = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.ENGLISH);
    private static final String DEFAULT_IMAGE = "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80";

    private final NewsArticleRepository newsArticleRepository;
    private final ExternalNewsService externalNewsService;

    public NewsService(NewsArticleRepository newsArticleRepository, ExternalNewsService externalNewsService) {
        this.newsArticleRepository = newsArticleRepository;
        this.externalNewsService = externalNewsService;
    }

    public List<NewsFeedItem> getNews(String location, Double latitude, Double longitude) {
        String requestedLocation = normalizeLocation(location, latitude, longitude);
        List<NewsFeedItem> liveNews = externalNewsService.fetchLiveNews(requestedLocation);
        if (!liveNews.isEmpty()) {
            persistExternalNews(liveNews, requestedLocation);
            return liveNews;
        }

        if (LOCATION_ALL.equalsIgnoreCase(requestedLocation)) {
            return newsArticleRepository.findAllByOrderByPublishedAtDescIdDesc()
                    .stream()
                    .map(this::toFeedItem)
                    .toList();
        }

        if (LOCATION_NATIONAL.equalsIgnoreCase(requestedLocation)) {
            return newsArticleRepository.findByCountryIgnoreCaseOrderByPublishedAtDescIdDesc(LOCATION_NATIONAL)
                    .stream()
                    .map(this::toFeedItem)
                    .toList();
        }

        return newsArticleRepository.findNationalAndRegion(LOCATION_NATIONAL, requestedLocation)
                .stream()
                .map(this::toFeedItem)
                .toList();
    }

    private String normalizeLocation(String location, Double latitude, Double longitude) {
        if (location == null || location.isBlank()) {
            return resolveLocationFromCoordinates(latitude, longitude);
        }

        if (LOCATION_LOCAL.equalsIgnoreCase(location)) {
            return resolveLocationFromCoordinates(latitude, longitude);
        }

        return location;
    }

    private String resolveLocationFromCoordinates(Double latitude, Double longitude) {
        if (Objects.isNull(latitude) || Objects.isNull(longitude)) {
            return "Metro District";
        }

        // Temporary deterministic mapping while reverse-geocoding is not integrated.
        if (longitude < 121.0) {
            return "North Province";
        }

        if (latitude < 14.4) {
            return "Central Region";
        }

        return "Metro District";
    }

    private NewsFeedItem toFeedItem(NewsArticle article) {
        String effectiveLocation = firstNonBlank(article.getRegion(), article.getCountry(), LOCATION_NATIONAL);
        String excerpt = firstNonBlank(article.getSummary(), truncate(article.getContent(), 180), "No summary available.");
        String author = firstNonBlank(article.getSource(), "NewsHub Desk");
        String category = classifyCategory(article.getSource(), article.getCountry());
        String image = firstNonBlank(article.getMediaUrls(), DEFAULT_IMAGE);
        String date = article.getPublishedAt() != null
                ? FEED_DATE_FORMATTER.format(article.getPublishedAt())
                : "Unknown date";
        String readTime = estimateReadTime(article.getContent());

        return new NewsFeedItem(
                article.getId(),
                effectiveLocation,
                category,
                article.getTitle(),
                excerpt,
            firstNonBlank(article.getContent(), excerpt),
                author,
                date,
                readTime,
                image,
            "DATABASE",
            null
        );
    }

    private void persistExternalNews(List<NewsFeedItem> liveNews, String requestedLocation) {
        List<NewsArticle> newArticles = liveNews.stream()
                .filter(item -> !newsArticleRepository.existsByTitleIgnoreCaseAndSourceIgnoreCase(item.title(), item.author()))
                .map(item -> new NewsArticle(
                        item.title(),
                        item.excerpt(),
                    firstNonBlank(item.content(), item.excerpt()),
                        item.image(),
                        item.author(),
                        resolveCountryForLocation(requestedLocation),
                        resolveRegionForLocation(requestedLocation),
                        parseFeedDate(item.date()),
                        null
                ))
                .toList();

        if (!newArticles.isEmpty()) {
            newsArticleRepository.saveAll(newArticles);
        }
    }

    private LocalDateTime parseFeedDate(String feedDate) {
        if (feedDate == null || feedDate.isBlank() || "Latest".equalsIgnoreCase(feedDate)) {
            return LocalDateTime.now();
        }
        try {
            return LocalDateTime.parse(feedDate + " 00:00", DateTimeFormatter.ofPattern("MMM d, yyyy HH:mm", Locale.ENGLISH));
        } catch (Exception ignored) {
            return LocalDateTime.now();
        }
    }

    private String resolveCountryForLocation(String requestedLocation) {
        if (LOCATION_NATIONAL.equalsIgnoreCase(requestedLocation) || LOCATION_ALL.equalsIgnoreCase(requestedLocation)) {
            return "National";
        }
        return "Philippines";
    }

    private String resolveRegionForLocation(String requestedLocation) {
        if (requestedLocation == null || requestedLocation.isBlank()) {
            return "Metro District";
        }
        if (LOCATION_NATIONAL.equalsIgnoreCase(requestedLocation) || LOCATION_ALL.equalsIgnoreCase(requestedLocation)) {
            return null;
        }
        return requestedLocation;
    }

    private String classifyCategory(String source, String country) {
        String src = firstNonBlank(source, "").toLowerCase(Locale.ROOT);
        if (src.contains("election")) {
            return "Politics";
        }
        if (src.contains("tech") || src.contains("cyber")) {
            return "Technology";
        }
        if (src.contains("transport") || src.contains("transit")) {
            return "Infrastructure";
        }

        if ("National".equalsIgnoreCase(country)) {
            return "National";
        }

        return "Top Story";
    }

    private String estimateReadTime(String content) {
        if (content == null || content.isBlank()) {
            return "3 min read";
        }
        int words = content.trim().split("\\s+").length;
        int minutes = Math.max(1, (int) Math.ceil(words / 200.0));
        return minutes + " min read";
    }

    private String truncate(String text, int maxLength) {
        if (text == null || text.isBlank()) {
            return "";
        }
        if (text.length() <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength - 3) + "...";
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
    }
}
