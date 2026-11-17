package com.newshub.backend.location.application;

/**
 * A normalized place, the single location shape used by the API and the frontend.
 *
 * @param area        city / town / municipality the news feed is scoped to (e.g. "Palo")
 * @param region      province or state, used to tell same-name places apart (e.g. "Leyte"); may be null
 * @param country     English country name from OpenStreetMap (e.g. "Philippines")
 * @param countryCode ISO 3166-1 alpha-2, upper case (e.g. "PH")
 * @param label       display text (e.g. "Palo, Leyte, Philippines")
 * @param latitude    may be null
 * @param longitude   may be null
 * @param matchedName the name the user searched for when it differs from area
 *                    (searching "Pawing" yields area "Palo", matchedName "Pawing"); may be null
 * @param kind        "city", "province" or "country" — lets the UI hint what a suggestion covers
 */
public record LocationResult(
        String area,
        String region,
        String country,
        String countryCode,
        String label,
        Double latitude,
        Double longitude,
        String matchedName,
        String kind
) {
}
