package com.newshub.backend.location.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newshub.backend.location.api.dto.LocationDetectResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

@RestController
@RequestMapping("/api/location")
public class LocationController {

    private static final String IP_LOOKUP_URL = "https://ipapi.co/json/";
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(6);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(10);

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public LocationController(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(CONNECT_TIMEOUT)
                .build();
    }

    @GetMapping("/detect")
    public ResponseEntity<LocationDetectResponse> detectLocation() {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(IP_LOOKUP_URL))
                    .timeout(REQUEST_TIMEOUT)
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            int status = response.statusCode();
            if (status < 200 || status > 299) {
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
            }

            Map<String, Object> payload = objectMapper.readValue(
                    response.body(),
                    new TypeReference<Map<String, Object>>() {}
            );

            String area = firstNonBlank(normalizeText(payload.get("city")), normalizeText(payload.get("region")));
            String country = normalizeText(payload.get("country_name"));
            Double latitude = normalizeNumber(payload.get("latitude"));
            Double longitude = normalizeNumber(payload.get("longitude"));

            if (area == null || country == null) {
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
            }

            return ResponseEntity.ok(new LocationDetectResponse(area, country, latitude, longitude));
        } catch (Exception ignored) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
        }
    }

    private static String normalizeText(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isBlank() ? null : text;
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private static Double normalizeNumber(Object value) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        if (value instanceof String text) {
            try {
                return Double.parseDouble(text);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }
}
