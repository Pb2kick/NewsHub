package com.newshub.backend.location.api;

import com.newshub.backend.location.application.GeocodingService;
import com.newshub.backend.location.application.LocationResult;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Location lookups for the frontend. Every place comes back in the same
 * normalized shape ({@link LocationResult}): a city-level area, its province or
 * state, the English country name and the ISO country code.
 *
 * <p>Replaces GET /api/location/detect, which called ipapi.co from the server
 * and always failed on Render (the frontend already looks up the visitor's IP
 * itself and now sends the resulting coordinates to /reverse).
 */
@RestController
@RequestMapping("/api/location")
public class LocationController {

    private final GeocodingService geocodingService;

    public LocationController(GeocodingService geocodingService) {
        this.geocodingService = geocodingService;
    }

    /**
     * Resolves GPS or IP coordinates to a city-level place.
     *
     * @return the place, or 404 when nothing usable was found
     */
    @GetMapping("/reverse")
    public ResponseEntity<LocationResult> reverse(@RequestParam double lat, @RequestParam double lng) {
        return geocodingService.reverse(lat, lng)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * Suggests places for the location box (search-as-you-type).
     *
     * @param q   typed text, at least 2 characters
     * @param lat optional latitude to rank nearby places first
     * @param lng optional longitude to rank nearby places first
     * @return up to 6 places; empty when nothing matches
     */
    @GetMapping("/search")
    public List<LocationResult> search(@RequestParam(defaultValue = "") String q,
                                       @RequestParam(required = false) Double lat,
                                       @RequestParam(required = false) Double lng) {
        return geocodingService.search(q, lat, lng);
    }
}
