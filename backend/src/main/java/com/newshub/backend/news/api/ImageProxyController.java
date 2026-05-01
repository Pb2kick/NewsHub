package com.newshub.backend.news.api;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Proxies external article images through the backend to bypass publisher
 * hotlink protection. The browser only ever makes requests to our own origin,
 * so no foreign Origin or Referer header is sent to the publisher directly.
 *
 * <p>The proxy:
 * <ul>
 *   <li>Validates the requested URL is HTTP/HTTPS.</li>
 *   <li>Follows redirects (CDNs commonly redirect to their actual asset host).</li>
 *   <li>Sends a Referer header that matches the publisher's own domain so
 *       server-side hotlink checks are satisfied.</li>
 *   <li>Rejects non-image Content-Type responses with 502.</li>
 *   <li>Caps response body at 10 MB to prevent memory abuse.</li>
 *   <li>Sets Cache-Control: public, max-age=86400 to avoid hammering publishers
 *       on every page load.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/news")
public class ImageProxyController {

    private static final int MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
    private static final String CACHE_CONTROL_VALUE = "public, max-age=86400";

    private final HttpClient httpClient;

    public ImageProxyController() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(8))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    /**
     * Fetches an external image URL server-side and streams the bytes back.
     *
     * @param url percent-encoded absolute URL of the image to proxy
     * @return proxied image bytes with original Content-Type, or an error response
     */
    @GetMapping("/image-proxy")
    public ResponseEntity<byte[]> proxyImage(@RequestParam String url) {
        // --- Validate the incoming URL ---
        if (url == null || url.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        String trimmedUrl = url.trim();
        if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
            return ResponseEntity.badRequest().build();
        }

        // --- Derive a plausible Referer from the target host ---
        String referer = deriveReferer(trimmedUrl);

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(trimmedUrl))
                    .timeout(Duration.ofSeconds(12))
                    // Mimic a browser User-Agent so publishers do not block bot traffic.
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                            + "AppleWebKit/537.36 (KHTML, like Gecko) "
                            + "Chrome/124.0.0.0 Safari/537.36")
                    // Send the publisher's own domain as Referer so hotlink checks pass.
                    .header("Referer", referer)
                    .header("Accept", "image/*,*/*;q=0.8")
                    .GET()
                    .build();

            HttpResponse<byte[]> upstream = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofByteArray()
            );

            int statusCode = upstream.statusCode();

            // Treat any non-2xx upstream response as a bad gateway.
            if (statusCode < 200 || statusCode > 299) {
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
            }

            // --- Validate Content-Type ---
            String contentType = upstream.headers()
                    .firstValue("Content-Type")
                    .orElse("");

            if (!contentType.startsWith("image/")) {
                // Upstream returned something that is not an image — reject it.
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
            }

            byte[] body = upstream.body();

            // --- Cap at 10 MB ---
            if (body == null || body.length > MAX_IMAGE_BYTES) {
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
            }

            HttpHeaders responseHeaders = new HttpHeaders();
            responseHeaders.set(HttpHeaders.CONTENT_TYPE, contentType);
            responseHeaders.set(HttpHeaders.CACHE_CONTROL, CACHE_CONTROL_VALUE);
            responseHeaders.setContentLength(body.length);

            return new ResponseEntity<>(body, responseHeaders, HttpStatus.OK);

        } catch (Exception ignored) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
        }
    }

    /**
     * Derives a Referer header value from the target image URL by extracting
     * only the scheme and host. This satisfies the most common hotlink check
     * pattern where publishers verify that the Referer matches their own domain.
     *
     * @param imageUrl absolute image URL
     * @return scheme + host origin string, or the full URL as fallback
     */
    private String deriveReferer(String imageUrl) {
        try {
            URI uri = URI.create(imageUrl);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (scheme != null && host != null) {
                int port = uri.getPort();
                if (port > 0) {
                    return scheme + "://" + host + ":" + port + "/";
                }
                return scheme + "://" + host + "/";
            }
        } catch (Exception ignored) {
            // Fall through to returning the raw URL.
        }
        return imageUrl;
    }
}
