-- Media collection retries a failed object instead of abandoning it, and the
-- retry must not keep the object at the head of the batch order forever.
-- `gc_after` already orders the eligible batch and decides when a row is next
-- tried, so a failure only moves that clock forward; `gc_attempts` records how
-- far the backoff has grown.
ALTER TABLE assets ADD COLUMN gc_attempts INTEGER NOT NULL DEFAULT 0 CHECK(gc_attempts>=0);
