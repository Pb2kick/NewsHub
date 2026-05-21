package com.newshub.backend.location.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newshub.backend.location.api.dto.LocationDetectResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

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
    // Static instance - no Spring injection needed. // CHANGED // REMOVED
    // ObjectMapper is thread-safe after construction and safe to share. // CHANGED
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper(); // CHANGED // REMOVED

    public LocationController() { // CHANGED // REMOVED
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(CONNECT_TIMEOUT)
                .build();
    }

    @GetMapping("/detect")
    public ResponseEntity<LocationDetectResponse> detectLocation(HttpServletRequest httpRequest) {
        try {
            String clientIp = extractClientIp(httpRequest);
            String ipapiUrl = (clientIp != null && !clientIp.isBlank() && !isPrivateOrLoopback(clientIp))
                    ? "https://ipapi.co/" + clientIp + "/json/"
                    : IP_LOOKUP_URL;
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(ipapiUrl))
                    .timeout(REQUEST_TIMEOUT)
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            int status = response.statusCode();
            if (status < 200 || status > 299) {
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
            }

            Map<String, Object> payload = OBJECT_MAPPER.readValue( // CHANGED
                    response.body(), // CHANGED
                    new TypeReference<Map<String, Object>>() {} // CHANGED
            ); // CHANGED

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

    private String extractClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }

    private static boolean isPrivateOrLoopback(String ip) {
        if (ip == null || ip.isBlank()) {
            return true;
        }
        String normalized = ip.trim();
        if ("::1".equals(normalized) || normalized.startsWith("127.")) {
            return true;
        }
        if (normalized.startsWith("10.") || normalized.startsWith("192.168.")) {
            return true;
        }
        if (normalized.startsWith("172.")) {
            String[] parts = normalized.split("\\.");
            if (parts.length >= 2) {
                try {
                    int secondOctet = Integer.parseInt(parts[1]);
                    return secondOctet >= 16 && secondOctet <= 31;
                } catch (NumberFormatException ignored) {
                    return false;
                }
            }
        }
        return false;
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
