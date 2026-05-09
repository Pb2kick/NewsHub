package com.newshub.backend.ai;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Server-side proxy for the Anthropic Messages API.
 *
 * Keeps the API key server-side (never exposed to the browser) and avoids the
 * CORS restriction that prevents direct browser-to-Anthropic calls.
 *
 * Uses Java 11+ java.net.http.HttpClient and builds the request body as a
 * plain JSON string — no Jackson / ObjectMapper needed, avoiding the
 * com.fasterxml.jackson.databind compile error on spring-boot-starter-webmvc.
 */
@Service
public class AiProxyService {

    private static final String ANTHROPIC_VERSION = "2023-06-01";

    /**
     * Fixed user prompt — escaped once here as a JSON string value so it can be
     * safely embedded directly into the hand-built request body.
     */
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
            // Build the JSON body as a plain string — no Jackson dependency required.
            // The prompt is embedded via escapeJson() to handle any special characters safely.
            String jsonBody = "{"
                    + "\"model\":\"" + escapeJson(model) + "\","
                    + "\"max_tokens\":1500,"
                    + "\"tools\":[{\"type\":\"web_search_20250305\",\"name\":\"web_search\"}],"
                    + "\"messages\":[{\"role\":\"user\",\"content\":\"" + escapeJson(PH_ELECTION_PROMPT) + "\"}]"
                    + "}";

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

    /**
     * Minimal JSON string escaper — handles the characters that can appear in the
     * fixed prompt so it embeds safely into the hand-built JSON body.
     * Covers: backslash, double-quote, newline, carriage-return, tab.
     *
     * @param value raw string value
     * @return JSON-safe escaped string (without surrounding quotes)
     */
    private static String escapeJson(String value) {
        if (value == null) return "";
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
