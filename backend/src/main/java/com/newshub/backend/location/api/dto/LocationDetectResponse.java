package com.newshub.backend.location.api.dto;

public record LocationDetectResponse(
        String area,
        String country,
        Double latitude,
        Double longitude
) {
}
