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
    void areaTokenDropsAdministrativePrefixes() {
        assertEquals("manila", ExternalNewsService.areaMatchToken("City of Manila"));
        assertEquals("quezon city", ExternalNewsService.areaMatchToken("Quezon City"));
        assertEquals("new orleans", ExternalNewsService.areaMatchToken(" New Orleans "));
    }
}
