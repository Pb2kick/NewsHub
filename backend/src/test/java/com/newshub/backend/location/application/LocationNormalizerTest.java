package com.newshub.backend.location.application;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Fixtures mirror real responses captured on 2026-11-17. */
class LocationNormalizerTest {

    @Test
    void nominatimReverseGivesTownProvinceAndCountryCode() {
        // Reverse lookup of the coordinates an IP lookup labelled "Pawing" (a barangay).
        Map<String, Object> address = Map.of(
                "town", "Palo", "state_district", "1st District", "state", "Leyte",
                "region", "Eastern Visayas", "country", "Philippines", "country_code", "ph");

        LocationResult place = LocationNormalizer.fromNominatim(address, 11.18, 125.00278).orElseThrow();

        assertEquals("Palo", place.area());
        assertEquals("Leyte", place.region());
        assertEquals("Philippines", place.country());
        assertEquals("PH", place.countryCode());
        assertEquals("Palo, Leyte, Philippines", place.label());
        assertEquals("city", place.kind());
    }

    @Test
    void nominatimWithoutCountryIsRejected() {
        assertTrue(LocationNormalizer.fromNominatim(Map.of("town", "Palo"), 1, 2).isEmpty());
    }

    @Test
    void photonNeighbourhoodRollsUpToItsCity() {
        Map<String, Object> pawing = photon("district", "Pawing", "Palo", "Leyte", "Philippines", "PH");

        LocationResult place = LocationNormalizer.fromPhoton(pawing, 125.0, 11.18).orElseThrow();

        assertEquals("Palo", place.area());
        assertEquals("Leyte", place.region());
        assertEquals("Pawing", place.matchedName(), "the UI can show what the user typed");
    }

    @Test
    void sameNameCitiesStayDistinctByProvince() {
        LocationResult cebu = LocationNormalizer.fromPhoton(
                photon("city", "Naga", null, "Cebu", "Philippines", "PH"), 123.75, 10.2).orElseThrow();
        LocationResult bicol = LocationNormalizer.fromPhoton(
                photon("city", "Naga", null, "Bicol Region", "Philippines", "PH"), 123.18, 13.62).orElseThrow();

        assertEquals("Naga, Cebu, Philippines", cebu.label());
        assertEquals("Naga, Bicol Region, Philippines", bicol.label());
        assertNull(cebu.matchedName());
    }

    @Test
    void provincesAndCountriesAreLabelledByKind() {
        LocationResult province = LocationNormalizer.fromPhoton(
                photon("state", "Quezon", null, null, "Philippines", "PH"), 121.6, 14.0).orElseThrow();
        LocationResult country = LocationNormalizer.fromPhoton(
                photon("country", "Singapore", null, null, "Singapore", "SG"), 103.8, 1.35).orElseThrow();

        assertEquals("province", province.kind());
        assertEquals("Quezon, Philippines", province.label());
        assertEquals("country", country.kind());
        assertEquals("Singapore", country.label(), "a city-state is not labelled 'Singapore, Singapore'");
    }

    @Test
    void administrativePrefixesAreDropped() {
        assertEquals("Manila", LocationNormalizer.cleanArea("City of Manila"));
        assertEquals("Quezon City", LocationNormalizer.cleanArea("Quezon City"));
        assertNull(LocationNormalizer.cleanArea("  "));
    }

    private static Map<String, Object> photon(String type, String name, String city, String state,
                                              String country, String countryCode) {
        Map<String, Object> properties = new HashMap<>();
        properties.put("type", type);
        properties.put("name", name);
        properties.put("city", city);
        properties.put("state", state);
        properties.put("country", country);
        properties.put("countrycode", countryCode);
        return properties;
    }
}
