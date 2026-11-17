package com.newshub.backend.news.application;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class NewsQueryHelpersTest {

    @Test
    void likeMetacharactersAreEscaped() {
        assertEquals("100\\%", NewsService.escapeLikePattern("100%"));
        assertEquals("snake\\_case", NewsService.escapeLikePattern("snake_case"));
        assertEquals("back\\\\slash", NewsService.escapeLikePattern("back\\slash"));
        assertEquals("cruise ship", NewsService.escapeLikePattern("cruise ship"));
    }

    @Test
    void unknownCountryProducesNoQueries() {
        assertTrue(ExternalNewsService.queriesForLocation("National", "").isEmpty());
        assertTrue(ExternalNewsService.queriesForLocation("Manila", null).isEmpty());
    }

    @Test
    void nationalUsesSeveralCountryPhrasings() {
        List<String> queries = ExternalNewsService.queriesForLocation("National", "United States");
        assertTrue(queries.contains("United States news"));
        assertTrue(queries.size() > 1);
    }

    @Test
    void internationalNoLongerUsesTheZeroResultPhrasing() {
        List<String> queries = ExternalNewsService.queriesForLocation("International", "Philippines");
        assertTrue(queries.size() > 1);
        assertTrue(queries.stream().noneMatch(q -> q.contains("headlines near")));
    }

    @Test
    void nationalAddsTheShortCountryNameWhenThereIsOne() {
        List<String> us = ExternalNewsService.queriesForLocation("National", "United States");
        assertTrue(us.contains("US economy"));
        List<String> ph = ExternalNewsService.queriesForLocation("National", "Philippines");
        assertEquals(ph.size(), ph.stream().distinct().count(), "no duplicate queries when there is no short name");
    }

    @Test
    void localQueriesIncludeTheArea() {
        List<String> queries = ExternalNewsService.queriesForLocation("New Orleans", "United States");
        assertTrue(queries.stream().allMatch(q -> q.startsWith("New Orleans")));
    }

    @Test
    void localFallsBackToCountryMentionsNeverToUnrelatedItems() {
        ExternalNewsService.RssItem pawPatrol = rss("Paw Patrol fans, get ready!", "A fourth film is coming");
        ExternalNewsService.RssItem national = rss("Philippines approves solar factory", "Investment news");
        ExternalNewsService.RssItem local = rss("Pawing barangay hall reopens", "Leyte update");

        assertEquals(List.of(local),
                ExternalNewsService.filterForScope(List.of(pawPatrol, national, local), "Pawing", "Philippines"));
        assertEquals(List.of(national),
                ExternalNewsService.filterForScope(List.of(pawPatrol, national), "Pawing", "Philippines"));
        assertTrue(ExternalNewsService.filterForScope(List.of(pawPatrol), "Pawing", "Philippines").isEmpty());
    }

    private static ExternalNewsService.RssItem rss(String title, String description) {
        return new ExternalNewsService.RssItem(title, description, "Wire", "",
                java.time.ZonedDateTime.now(), "https://example.com", "");
    }

    @Test
    void localQueriesAddTheProvinceWhenKnown() {
        List<String> queries = ExternalNewsService.queriesForLocation("Palo, Leyte", "Philippines", "Palo", "Leyte");
        assertTrue(queries.contains("Palo Leyte news"));
        assertTrue(queries.stream().noneMatch(q -> q.equals("Palo news")), "bare 'Palo news' returns Palo Alto");
    }

    @Test
    void bingUrlCarriesTheCountryMarketOnlyWhenValid() {
        assertTrue(ExternalNewsService.buildBingNewsRssUrl("x", "ph").endsWith("&cc=PH"));
        assertTrue(!ExternalNewsService.buildBingNewsRssUrl("x", null).contains("cc="));
        assertTrue(!ExternalNewsService.buildBingNewsRssUrl("x", "PHL").contains("cc="));
    }

    @Test
    void localScopeKeyCombinesAreaAndRegion() {
        assertEquals("Naga, Cebu", NewsService.localScopeKey("Naga", "Cebu"));
        assertEquals("Manila", NewsService.localScopeKey("Manila", null));
        assertEquals("Singapore", NewsService.localScopeKey("Singapore", "singapore"));
        assertEquals("", NewsService.localScopeKey(" ", "Cebu"));
    }

    @Test
    void localRelevanceUsesTheBareCityName() {
        ExternalNewsService.RssItem palo = rss("Palo eyes stronger tourism presence", "Leyte");
        assertEquals(List.of(palo),
                ExternalNewsService.filterForScope(List.of(palo), "Palo, Leyte", "Philippines", "Palo"));
    }

    @Test
    void tsQueryIsWordOrderFreeWithPrefixOnTheLastWord() {
        assertEquals("cruise & ship & cras:*", NewsService.buildTsQuery("Cruise ship cras"));
        assertEquals("pelicans:*", NewsService.buildTsQuery("  Pelicans' "));
    }

    @Test
    void tsQueryOperatorsInUserInputAreDropped() {
        assertEquals("a & b:*", NewsService.buildTsQuery("a & | ! ( ) :* b"));
        assertEquals("", NewsService.buildTsQuery("&|!():*"));
        assertEquals("", NewsService.buildTsQuery(null));
    }

    @Test
    void categoryTabsMapToStoredValues() {
        assertEquals("Politics", NewsService.normalizeCategory("politics"));
        assertEquals("", NewsService.normalizeCategory("Top Stories"));
        assertEquals("", NewsService.normalizeCategory("Sports"));
        assertEquals("", NewsService.normalizeCategory(null));
    }

    @Test
    void areaTokenDropsAdministrativePrefixes() {
        assertEquals("manila", ExternalNewsService.areaMatchToken("City of Manila"));
        assertEquals("quezon city", ExternalNewsService.areaMatchToken("Quezon City"));
        assertEquals("new orleans", ExternalNewsService.areaMatchToken(" New Orleans "));
    }
}
