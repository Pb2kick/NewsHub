package com.newshub.backend.platform.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Cheap liveness check. The frontend calls it as soon as the page opens so a
 * sleeping free-tier server starts waking up while the visitor signs in,
 * instead of when the first news or location request arrives.
 */
@RestController
public class HealthController {

    /** @return {"status":"ok"} without touching the database or external services */
    @GetMapping("/api/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }
}
