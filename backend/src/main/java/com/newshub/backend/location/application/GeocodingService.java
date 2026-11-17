package com.newshub.backend.location.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.LinkedHashSet;

/**
 * Server-side geocoding so every client gets the same normalized places.
 *
 * <ul>
 *   <li>Reverse lookups (GPS / IP coordinates → city) use Nominatim at zoom 10.
 *       Nominatim's usage policy requires an identifying User-Agent (browsers
 *       cannot set one) and at most one request per second, so calls are
 *       throttled here and results cached by ~1 km grid cell.</li>
 *   <li>Place search for the location box uses Photon, which — unlike
 *       Nominatim — permits search-as-you-type. Results are cached per query.</li>
 * </ul>
 */
@Service
public class GeocodingService {

    static final String USER_AGENT = "NewsHub/1.0 (+https://github.com/Pb2kick/NewsHub)";
    private static final Duration NOMINATIM_MIN_GAP = Duration.ofMillis(1100);
    private static final Duration CACHE_TTL = Duration.ofHours(24);
    private static final int CACHE_MAX_ENTRIES = 2000;
    private static final int MAX_SUGGESTIONS = 6;

    /** Fetches a URL and returns its body, or null on any failure. Replaceable in tests. */
    @FunctionalInterface
    interface HttpFetcher {
        String get(String url);
    }

    private final HttpFetcher fetcher;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, CachedValue<Optional<LocationResult>>> reverseCache = lruCache();
    private final Map<String, CachedValue<List<LocationResult>>> searchCache = lruCache();
    private Instant lastNominatimCall = Instant.EPOCH;

    @Autowired
    public GeocodingService() {
        this(defaultFetcher());
    }

    GeocodingService(HttpFetcher fetcher) {
        this.fetcher = fetcher;
    }

    /**
     * Resolves coordinates to a city-level place.
     *
     * @return the place, or empty when the coordinates are invalid or the lookup fails
     */
    public Optional<LocationResult> reverse(double lat, double lng) {
        if (!Double.isFinite(lat) || !Double.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
            return Optional.empty();
        }
        String key = String.format(Locale.ROOT, "%.2f,%.2f", lat, lng);
        CachedValue<Optional<LocationResult>> cached = getFresh(reverseCache, key);
        if (cached != null) {
            return cached.value();
        }

        waitForNominatimSlot();
        String url = String.format(Locale.ROOT,
                "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=%.6f&lon=%.6f&zoom=10&addressdetails=1&accept-language=en",
                lat, lng);
        Optional<LocationResult> result = parse(fetcher.get(url))
                .map(body -> asMap(body.get("address")))
                .flatMap(address -> LocationNormalizer.fromNominatim(address, lat, lng));

        // Failures are not cached, so a temporary outage does not stick for a day.
        if (result.isPresent()) {
            put(reverseCache, key, result);
        }
        return result;
    }

    /**
     * Suggests places for a typed query, optionally biased toward the user's position.
     *
     * @param query    text typed by the user (at least 2 characters)
     * @param biasLat  optional latitude to rank nearby places first
     * @param biasLng  optional longitude to rank nearby places first
     * @return up to 6 distinct places
     */
    public List<LocationResult> search(String query, Double biasLat, Double biasLng) {
        String trimmed = query == null ? "" : query.trim();
        if (trimmed.length() < 2) {
            return List.of();
        }
        boolean hasBias = biasLat != null && biasLng != null && Double.isFinite(biasLat) && Double.isFinite(biasLng);
        String key = trimmed.toLowerCase(Locale.ROOT)
                + (hasBias ? String.format(Locale.ROOT, "@%.0f,%.0f", biasLat, biasLng) : "");
        CachedValue<List<LocationResult>> cached = getFresh(searchCache, key);
        if (cached != null) {
            return cached.value();
        }

        StringBuilder url = new StringBuilder("https://photon.komoot.io/api/?limit=10&lang=en&q=")
                .append(URLEncoder.encode(trimmed, StandardCharsets.UTF_8));
        for (String layer : List.of("city", "district", "locality", "county", "state", "country")) {
            url.append("&layer=").append(layer);
        }
        if (hasBias) {
            url.append(String.format(Locale.ROOT, "&lat=%.4f&lon=%.4f", biasLat, biasLng));
        }

        Optional<Map<String, Object>> body = parse(fetcher.get(url.toString()));
        if (body.isEmpty()) {
            return List.of(); // not cached: retry on the next keystroke
        }

        List<LocationResult> results = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (Object rawFeature : asList(body.get().get("features"))) {
            Map<String, Object> feature = asMap(rawFeature);
            List<Object> coordinates = asList(asMap(feature.get("geometry")).get("coordinates"));
            Double lng = coordinates.size() > 1 ? number(coordinates.get(0)) : null;
            Double lat = coordinates.size() > 1 ? number(coordinates.get(1)) : null;
            LocationNormalizer.fromPhoton(asMap(feature.get("properties")), lng, lat).ifPresent(place -> {
                if (seen.add((place.label() + "|" + place.kind()).toLowerCase(Locale.ROOT)) && results.size() < MAX_SUGGESTIONS) {
                    results.add(place);
                }
            });
        }

        List<LocationResult> immutable = List.copyOf(results);
        put(searchCache, key, immutable);
        return immutable;
    }

    private synchronized void waitForNominatimSlot() {
        Duration sinceLast = Duration.between(lastNominatimCall, Instant.now());
        if (sinceLast.compareTo(NOMINATIM_MIN_GAP) < 0) {
            try {
                Thread.sleep(NOMINATIM_MIN_GAP.minus(sinceLast).toMillis());
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
            }
        }
        lastNominatimCall = Instant.now();
    }

    private Optional<Map<String, Object>> parse(String body) {
        if (body == null || body.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(objectMapper.readValue(body, new TypeReference<Map<String, Object>>() {}));
        } catch (Exception malformed) {
            return Optional.empty();
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object value) {
        return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
    }

    @SuppressWarnings("unchecked")
    private static List<Object> asList(Object value) {
        return value instanceof List<?> list ? (List<Object>) list : List.of();
    }

    private static Double number(Object value) {
        return value instanceof Number n ? n.doubleValue() : null;
    }

    private static <V> Map<String, CachedValue<V>> lruCache() {
        return java.util.Collections.synchronizedMap(new LinkedHashMap<>(64, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, CachedValue<V>> eldest) {
                return size() > CACHE_MAX_ENTRIES;
            }
        });
    }

    private static <V> CachedValue<V> getFresh(Map<String, CachedValue<V>> cache, String key) {
        CachedValue<V> cached = cache.get(key);
        if (cached == null || cached.storedAt().plus(CACHE_TTL).isBefore(Instant.now())) {
            return null;
        }
        return cached;
    }

    private static <V> void put(Map<String, CachedValue<V>> cache, String key, V value) {
        cache.put(key, new CachedValue<>(value, Instant.now()));
    }

    private static HttpFetcher defaultFetcher() {
        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(6)).build();
        return url -> {
            try {
                HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                        .timeout(Duration.ofSeconds(8))
                        .header("User-Agent", USER_AGENT)
                        .header("Accept", "application/json")
                        .GET()
                        .build();
                HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
                return response.statusCode() / 100 == 2 ? response.body() : null;
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                return null;
            } catch (Exception failure) {
                return null;
            }
        };
    }

    private record CachedValue<V>(V value, Instant storedAt) {
    }
}
