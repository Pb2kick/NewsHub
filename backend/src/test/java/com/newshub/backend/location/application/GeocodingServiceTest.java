package com.newshub.backend.location.application;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GeocodingServiceTest {

    private static final String NOMINATIM_PALO = """
            {"address": {"town": "Palo", "state": "Leyte", "country": "Philippines", "country_code": "ph"}}
            """;

    private static final String PHOTON_NAGA = """
            {"features": [
              {"geometry": {"coordinates": [123.18, 13.62]},
               "properties": {"type": "city", "name": "Naga", "state": "Bicol Region", "country": "Philippines", "countrycode": "PH"}},
              {"geometry": {"coordinates": [123.75, 10.20]},
               "properties": {"type": "city", "name": "Naga", "state": "Cebu", "country": "Philippines", "countrycode": "PH"}},
              {"geometry": {"coordinates": [123.75, 10.20]},
               "properties": {"type": "city", "name": "Naga", "state": "Cebu", "country": "Philippines", "countrycode": "PH"}},
              {"geometry": {"coordinates": [0, 0]}, "properties": {"type": "city", "name": "No country"}}
            ]}
            """;

    @Test
    void reverseIsCachedPerGridCell() {
        List<String> calls = new ArrayList<>();
        GeocodingService service = new GeocodingService(url -> {
            calls.add(url);
            return NOMINATIM_PALO;
        });

        assertEquals("Palo", service.reverse(11.1801, 125.0028).orElseThrow().area());
        assertEquals("Palo", service.reverse(11.1834, 125.0011).orElseThrow().area());

        assertEquals(1, calls.size(), "nearby coordinates reuse the cached lookup");
        assertTrue(calls.get(0).contains("zoom=10") && calls.get(0).contains("accept-language=en"));
    }

    @Test
    void failedReverseLookupsAreNotCached() {
        List<String> calls = new ArrayList<>();
        GeocodingService service = new GeocodingService(url -> {
            calls.add(url);
            return calls.size() == 1 ? null : NOMINATIM_PALO;
        });

        assertTrue(service.reverse(11.18, 125.0).isEmpty());
        assertTrue(service.reverse(11.18, 125.0).isPresent());
    }

    @Test
    void invalidCoordinatesNeverHitTheNetwork() {
        GeocodingService service = new GeocodingService(url -> {
            throw new AssertionError("should not fetch " + url);
        });
        assertTrue(service.reverse(123, 0).isEmpty());
        assertTrue(service.reverse(Double.NaN, 0).isEmpty());
    }

    @Test
    void searchDeduplicatesSkipsUnusableFeaturesAndCaches() {
        List<String> calls = new ArrayList<>();
        GeocodingService service = new GeocodingService(url -> {
            calls.add(url);
            return PHOTON_NAGA;
        });

        List<LocationResult> results = service.search("Naga", null, null);
        service.search("naga ", null, null);

        assertEquals(2, results.size());
        assertEquals("Naga, Bicol Region, Philippines", results.get(0).label());
        assertEquals("Naga, Cebu, Philippines", results.get(1).label());
        assertEquals(1, calls.size(), "same query (case/space-insensitive) is served from cache");
        assertTrue(calls.get(0).contains("layer=city") && calls.get(0).contains("lang=en"));
    }

    @Test
    void shortQueriesReturnNothing() {
        GeocodingService service = new GeocodingService(url -> {
            throw new AssertionError("should not fetch " + url);
        });
        assertTrue(service.search("n", null, null).isEmpty());
    }
}
