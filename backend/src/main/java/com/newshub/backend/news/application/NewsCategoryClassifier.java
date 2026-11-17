package com.newshub.backend.news.application;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Assigns one of the homepage categories to an article.
 *
 * <p>Keywords are matched as whole words (with an optional stem suffix where
 * noted), never as raw substrings. Substring matching tagged most articles as
 * Technology because "ai" occurs inside "said", "again" and "failure", and
 * tagged pollution stories as Elections because "poll" occurs in "pollution".
 *
 * <p>Each category is scored by how many distinct keywords match; the highest
 * score wins, ties resolve in declaration order, and zero matches means
 * "Top Stories".
 */
public final class NewsCategoryClassifier {

    public static final String TOP_STORIES = "Top Stories";
    public static final String ELECTIONS = "Elections";
    public static final String TECHNOLOGY = "Technology";
    public static final String ECONOMY = "Economy";
    public static final String POLITICS = "Politics";

    private static final Map<String, Pattern[]> KEYWORDS = new LinkedHashMap<>();

    static {
        KEYWORDS.put(ELECTIONS, words(
                "elections?", "electoral", "voters?", "votes?", "voting", "ballots?",
                "candidates?", "candidacy", "campaign(?:s|ing)?", "polls?", "polling station",
                "comelec", "primar(?:y|ies)", "referendum"));
        KEYWORDS.put(TECHNOLOGY, words(
                "technolog(?:y|ies|ical)", "tech", "ai", "artificial intelligence", "cyber\\w*",
                "digital", "software", "hardware", "internet", "smartphones?", "apps?",
                "startups?", "semiconductors?", "chips?", "robot\\w*", "data cent(?:er|re)s?",
                // Not "online": it appears in ordinary stories ("posted online") and tagged an
                // Albay evacuation report as Technology.
                "fintech"));
        KEYWORDS.put(ECONOMY, words(
                "econom\\w*", "business(?:es)?", "markets?", "financ\\w*", "inflation",
                "trade", "tariffs?", "gdp", "investments?", "investors?", "stocks?",
                "banks?", "peso", "dollar", "prices?", "jobs", "employment", "revenue"));
        KEYWORDS.put(POLITICS, words(
                "politic\\w*", "government", "senate", "senators?",
                // Not "congress\w*": "Congressional Avenue" is a Quezon City street.
                "congress", "congress(?:man|men|woman|women)",
                "lawmakers?", "legislat\\w*", "president(?:ial)?", "ministers?",
                "parliament\\w*", "policy", "policies", "mayor", "governor", "cabinet"));
    }

    private NewsCategoryClassifier() {
    }

    /**
     * Classifies an article, preferring an explicit feed category when it maps
     * cleanly to a homepage tab.
     *
     * @param explicitCategory category supplied by the feed, may be blank
     * @param texts            title, summary, content, source (any may be null)
     * @return homepage category label
     */
    public static String classify(String explicitCategory, String... texts) {
        String explicit = explicitCategory == null ? "" : explicitCategory.toLowerCase(Locale.ROOT);
        if (!explicit.isBlank()) {
            if (explicit.contains("elect") || explicit.contains("vote")) {
                return ELECTIONS;
            }
            if (explicit.contains("politic") || explicit.contains("government")) {
                return POLITICS;
            }
            if (explicit.contains("econom") || explicit.contains("business") || explicit.contains("financ")) {
                return ECONOMY;
            }
            if (explicit.contains("tech") || explicit.contains("science")) {
                return TECHNOLOGY;
            }
        }

        StringBuilder builder = new StringBuilder();
        for (String text : texts) {
            if (text != null) {
                builder.append(' ').append(text);
            }
        }
        String searchable = builder.toString().toLowerCase(Locale.ROOT);

        String best = TOP_STORIES;
        int bestScore = 0;
        for (Map.Entry<String, Pattern[]> entry : KEYWORDS.entrySet()) {
            int score = 0;
            for (Pattern pattern : entry.getValue()) {
                if (pattern.matcher(searchable).find()) {
                    score++;
                }
            }
            if (score > bestScore) {
                best = entry.getKey();
                bestScore = score;
            }
        }
        return best;
    }

    private static Pattern[] words(String... regexes) {
        Pattern[] patterns = new Pattern[regexes.length];
        for (int i = 0; i < regexes.length; i++) {
            patterns[i] = Pattern.compile("\\b(?:" + regexes[i] + ")\\b");
        }
        return patterns;
    }
}
