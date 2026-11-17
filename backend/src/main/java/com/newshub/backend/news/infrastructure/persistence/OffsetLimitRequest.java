package com.newshub.backend.news.infrastructure.persistence;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * A {@link Pageable} that starts at an exact row offset instead of a page index.
 *
 * <p>The home feed shows one featured article above a two-column grid, so it
 * loads 5 articles first (1 featured + 4 cards) and then 4 per "See more"
 * (two full rows). Page-index paging cannot express "start at row 5, take 4"
 * because the offset is always page × size.
 */
public final class OffsetLimitRequest implements Pageable {

    private final long offset;
    private final int limit;

    public OffsetLimitRequest(long offset, int limit) {
        if (offset < 0) {
            throw new IllegalArgumentException("offset must not be negative");
        }
        if (limit < 1) {
            throw new IllegalArgumentException("limit must be at least 1");
        }
        this.offset = offset;
        this.limit = limit;
    }

    @Override
    public int getPageNumber() {
        return (int) (offset / limit);
    }

    @Override
    public int getPageSize() {
        return limit;
    }

    @Override
    public long getOffset() {
        return offset;
    }

    @Override
    public Sort getSort() {
        return Sort.unsorted();
    }

    @Override
    public Pageable next() {
        return new OffsetLimitRequest(offset + limit, limit);
    }

    @Override
    public Pageable previousOrFirst() {
        return hasPrevious() ? new OffsetLimitRequest(Math.max(0, offset - limit), limit) : first();
    }

    @Override
    public Pageable first() {
        return new OffsetLimitRequest(0, limit);
    }

    @Override
    public Pageable withPage(int pageNumber) {
        return new OffsetLimitRequest((long) pageNumber * limit, limit);
    }

    @Override
    public boolean hasPrevious() {
        return offset > 0;
    }
}
