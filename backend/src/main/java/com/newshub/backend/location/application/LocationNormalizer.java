package com.newshub.backend.location.application;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Turns geocoder responses (Nominatim reverse, Photon search) into {@link LocationResult}.
 *
 * <p>Rules shared by both sources:
 * <ul>
 *   <li>The area is always a city / town / municipality. Neighbourhoods, villages
 *       and barangays roll up to their parent city, because news is written at
 *       city level (an IP lookup returned the barangay "Pawing", for which Bing
 *       had only unrelated results; its municipality "Palo" has real coverage).</li>
 *   <li>The region (province / state) is kept so same-name places stay distinct
 *       (Naga, Cebu vs. Naga, Bicol Region).</li>
 *   <li>Names are English (callers request {@code lang=en} / {@code accept-language=en}),
 *       and the ISO country code is always included.</li>
 * </ul>
 */
public final class LocationNormalizer {

    private static final List<String> AREA_KEYS =
            List.of("city", "town", "municipality", "village", "county", "state_district", "state");
    private static final List<String> REGION_KEYS = List.of("state", "province", "region", "state_district");
    private static final List<String> NEIGHBOURHOOD_TYPES = List.of("district", "locality", "house", "street", "other");

    private LocationNormalizer() {
    }

    /**
     * Normalizes a Nominatim reverse-geocoding response (requested with zoom=10).
     *
     * @param address the response's "address" object
     * @param lat     latitude that was looked up
     * @param lng     longitude that was looked up
     * @return the place, or empty when the address lacks an area or a country
     */
    public static Optional<LocationResult> fromNominatim(Map<String, Object> address, double lat, double lng) {
        if (address == null) {
            return Optional.empty();
        }
        String area = cleanArea(firstPresent(address, AREA_KEYS));
        String country = text(address.get("country"));
        String countryCode = upper(text(address.get("country_code")));
        if (area == null || country == null || countryCode == null) {
            return Optional.empty();
        }
        String region = distinctRegion(firstPresent(address, REGION_KEYS), area);
        return Optional.of(build(area, region, country, countryCode, lat, lng, null, "city"));
    }

    /**
     * Normalizes one Photon search feature.
     *
     * @param properties the feature's "properties" object
     * @param lng        longitude (GeoJSON order: coordinates[0])
     * @param lat        latitude (coordinates[1])
     * @return the place, or empty when it cannot be mapped to a city, province or country
     */
    public static Optional<LocationResult> fromPhoton(Map<String, Object> properties, Double lng, Double lat) {
        if (properties == null) {
            return Optional.empty();
        }
        String type = text(properties.get("type"));
        String name = text(properties.get("name"));
        String country = text(properties.get("country"));
        String countryCode = upper(text(properties.get("countrycode")));
        if (name == null || country == null || countryCode == null) {
            return Optional.empty();
        }

        if ("country".equals(type)) {
            return Optional.of(build(name, null, country, countryCode, lat, lng, null, "country"));
        }
        if ("state".equals(type)) {
            return Optional.of(build(cleanArea(name), null, country, countryCode, lat, lng, null, "province"));
        }

        String state = text(properties.get("state"));
        String parentCity = text(properties.get("city"));
        boolean isNeighbourhood = type != null && NEIGHBOURHOOD_TYPES.contains(type);
        String area = cleanArea(isNeighbourhood && parentCity != null ? parentCity : name);
        String matchedName = area.equalsIgnoreCase(name) ? null : name;
        return Optional.of(build(area, distinctRegion(state, area), country, countryCode, lat, lng, matchedName, "city"));
    }

    /**
     * Drops administrative prefixes that news text does not use:
     * "City of Manila" becomes "Manila". Names such as "Quezon City" are kept.
     */
    static String cleanArea(String raw) {
        if (raw == null) {
            return null;
        }
        String area = raw.trim();
        for (String prefix : List.of("City of ", "Municipality of ")) {
            if (area.regionMatches(true, 0, prefix, 0, prefix.length()) && area.length() > prefix.length()) {
                area = area.substring(prefix.length()).trim();
            }
        }
        return area.isBlank() ? null : area;
    }

    private static LocationResult build(String area, String region, String country, String countryCode,
                                        Double lat, Double lng, String matchedName, String kind) {
        StringBuilder label = new StringBuilder(area);
        if (region != null) {
            label.append(", ").append(region);
        }
        if (!area.equalsIgnoreCase(country)) {
            label.append(", ").append(country);
        }
        return new LocationResult(area, region, country, countryCode, label.toString(), lat, lng, matchedName, kind);
    }

    private static String distinctRegion(String region, String area) {
        if (region == null || region.equalsIgnoreCase(area)) {
            return null;
        }
        return region;
    }

    private static String firstPresent(Map<String, Object> source, List<String> keys) {
        for (String key : keys) {
            String value = text(source.get(key));
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private static String text(Object value) {
        if (value == null) {
            return null;
        }
        String trimmed = String.valueOf(value).trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String upper(String value) {
        return value == null ? null : value.toUpperCase(Locale.ROOT);
    }
}
