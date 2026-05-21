package com.newshub.backend.news.bootstrap;

import com.newshub.backend.news.domain.NewsArticle;
import com.newshub.backend.news.infrastructure.persistence.NewsArticleRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Component
public class NewsDataInitializer implements CommandLineRunner {

    private final NewsArticleRepository newsArticleRepository;

    public NewsDataInitializer(NewsArticleRepository newsArticleRepository) {
        this.newsArticleRepository = newsArticleRepository;
    }

    @Override
    public void run(String... args) {
        if (newsArticleRepository.count() > 0) {
            return;
        }

        List<NewsArticle> seedArticles = List.of(
                new NewsArticle(
                        "National Election Commission Announces Updated 2026 Voting Timeline",
                        "The commission released revised milestones for candidate filing, debates, and early voting periods across all regions.",
                        "The commission released revised milestones for candidate filing, debates, and early voting periods across all regions and detailed expected turnout shifts by province.",
                        "https://images.unsplash.com/photo-1494173853739-c21f58b16055?auto=format&fit=crop&w=1400&q=80",
                        "Election Commission",
                        null,
                        "National",
                        null,
                        LocalDateTime.of(2026, 3, 7, 10, 30),
                        null
                ),
                new NewsArticle(
                        "Government Expands SME Support Program for Urban Communities",
                        "A new package includes easier loan access and tax incentives for small businesses in dense city zones.",
                        "The package expands guarantee windows and subsidized interest programs for local entrepreneurs operating in high-density districts.",
                        "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80",
                        "Business Desk",
                        null,
                        "Philippines",
                        "Metro District",
                        LocalDateTime.of(2026, 3, 6, 9, 0),
                        null
                ),
                new NewsArticle(
                        "Digital ID Rollout Reaches 85% of Eligible Citizens",
                        "Officials say the secure ID platform improved access to online public services and reduced processing delays.",
                        "Officials said the rollout has accelerated onboarding to health, licensing, and civil registry services in northern areas.",
                        "https://images.unsplash.com/photo-1464037866556-6812c9d1c72e?auto=format&fit=crop&w=1200&q=80",
                        "Public Service Bureau",
                        null,
                        "Philippines",
                        "North Province",
                        LocalDateTime.of(2026, 3, 5, 13, 15),
                        null
                ),
                new NewsArticle(
                        "New Cybersecurity Framework Introduced for Election Infrastructure",
                        "The framework defines stricter controls for voter data handling, monitoring, and incident response.",
                        "Security teams now follow tighter requirements on endpoint hardening, telemetry retention, and emergency containment drills.",
                        "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80",
                        "Cyber Task Force",
                        null,
                        "Philippines",
                        "Metro District",
                        LocalDateTime.of(2026, 3, 4, 15, 45),
                        null
                ),
                new NewsArticle(
                        "Regional Transit Upgrade Targets Commute Delays",
                        "Transport officials approved a phased modernization plan covering key bus corridors and stations.",
                        "Infrastructure upgrades will prioritize transfer hubs, dedicated lanes, and timetable visibility for commuters.",
                        "https://images.unsplash.com/photo-1465447142348-e9952c393450?auto=format&fit=crop&w=1200&q=80",
                        "Transport Authority",
                        null,
                        "Philippines",
                        "Central Region",
                        LocalDateTime.of(2026, 3, 3, 8, 0),
                        null
                ),
                new NewsArticle(
                        "Global Summit on Climate Action Reaches Historic Agreement",
                        "Leaders agreed to coordinated targets and financing commitments to accelerate low-carbon transitions.",
                        "Negotiators finalized a new framework for emissions milestones, adaptation investments, and accountability reporting.",
                        "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1400&q=80",
                        "Global Affairs Desk",
                        null,
                        "National",
                        null,
                        LocalDateTime.of(2026, 3, 2, 18, 20),
                        null
                )
        );

        newsArticleRepository.saveAll(seedArticles);
    }
}
