package com.newshub.backend.ai;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Thin controller that proxies Anthropic API calls from the frontend.
 *
 * Route: POST /api/ai/fetch-ph-election
 * No request body required — the prompt is fixed inside AiProxyService.
 * No authentication required — follows the same open pattern as /api/news.
 *
 * The existing WebCorsConfig wildcard (*.onrender.com on /api/**) already
 * covers this route; no CORS changes are needed.
 */
@RestController
@RequestMapping("/api/ai")
public class AiProxyController {

    private final AiProxyService aiProxyService;

    public AiProxyController(AiProxyService aiProxyService) {
        this.aiProxyService = aiProxyService;
    }

    /**
     * Fetches the latest Philippine election data from Anthropic and returns the
     * raw JSON response body so the frontend can parse it with identical logic.
     *
     * @return 200 with raw Anthropic JSON body, or 502 with a JSON error object.
     */
    @PostMapping(value = "/fetch-ph-election", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> fetchPhElection() {
        try {
            String rawJson = aiProxyService.fetchPhElectionRaw();
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(rawJson);
        } catch (RuntimeException exception) {
            String errorBody = "{\"error\": \"" +
                    exception.getMessage().replace("\"", "'") + "\"}";
            return ResponseEntity.status(502)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(errorBody);
        }
    }
}
