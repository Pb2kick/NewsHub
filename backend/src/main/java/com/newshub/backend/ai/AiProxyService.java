package com.newshub.backend.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Server-side proxy for the Anthropic Messages API.
 *
 * Keeps the API key server-side (never exposed to the browser) and avoids the
 * CORS restriction that prevents direct browser-to-Anthropic calls.
 * Uses Java 11+ java.net.http.HttpClient — no additional Maven dependency required.
 */
@Service
public class AiProxyService {

    private static final String ANTHROPIC_VERSION = "2023-06-01";

    /** Fixed user prompt — never changes between calls. */
    private static final String PH_ELECTION_PROMPT =
            "Search for the single most recent or currently ongoing Philippine national or local " +
            "election as of today. Return ONLY a JSON object (no markdown) with this exact shape: " +
            "{ election: { name, region, start_date (YYYY-MM-DD), end_date (YYYY-MM-DD), " +
            "status (Active|Upcoming|Completed) }, candidates: [{ name, party, position, bio, photo_url }] }. " +
            "Use real candidate names and real parties from search results. " +
            "photo_url should be an empty string if not found.";

    @Value("${anthropic.api-key}")
    private String apiKey;

    @Value("${anthropic.api-url}")
    private String apiUrl;

    @Value("${anthropic.model}")
    private String model;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    /**
     * Sends the fixed Philippine election prompt to the Anthropic Messages API
     * and returns the raw response body string.
     *
     * @return raw Anthropic JSON response body
     * @throws RuntimeException with a user-readable message when the API returns a non-2xx status
     */
    public String fetchPhElectionRaw() {
        try {
            // Build request payload using Jackson so special characters are escaped correctly.
            Map<String, Object> requestBody = Map.of(
                    "model", model,
                    "max_tokens", 1500,
                    "tools", List.of(Map.of("type", "web_search_20250305", "name", "web_search")),
                    "messages", List.of(Map.of("role", "user", "content", PH_ELECTION_PROMPT))
            );
            String jsonBody = objectMapper.writeValueAsString(requestBody);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl))
                    .timeout(Duration.ofSeconds(30))
                    .header("Content-Type", "application/json")
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", ANTHROPIC_VERSION)
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new RuntimeException(
                        "Anthropic API returned status " + response.statusCode() +
                        ". Unable to fetch Philippine election data.");
            }

            return response.body();

        } catch (RuntimeException runtimeException) {
            throw runtimeException; // re-throw without wrapping so the message reaches the controller
        } catch (Exception exception) {
            throw new RuntimeException(
                    "Failed to contact the Anthropic API: " + exception.getMessage(), exception);
        }
    }
}
