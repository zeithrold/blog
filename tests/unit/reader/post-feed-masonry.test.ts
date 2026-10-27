import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FEED_ROW_HEIGHT, masonrySpan } from '@/features/reader/post-feed-masonry'
import { equal } from '~/tests/support/unit/assertions'

// A span of N rows occupies N*height; the item owns its vertical gap as padding.
// The smallest span that covers the measured card must be chosen, so cards never
// overlap and the spacing below them stays within one row height of the gap.
test('masonry spans cover the measured card with the smallest row count', () => {
  for (const height of [
    0,
    1,
    4,
    5,
    27,
    28,
    29,
    252,
    256,
    257,
    1000,
  ]) {
    const span = masonrySpan(height)
    assert.ok(Number.isInteger(span) && span >= 1, `span for ${height}`)
    assert.ok(span * FEED_ROW_HEIGHT >= height, `span ${span} covers ${height}`)
    if (span > 1) {
      assert.ok((span - 1) * FEED_ROW_HEIGHT < height, `span ${span - 1} would also cover ${height}`)
    }
  }
  equal(masonrySpan(0), 1)
  equal(masonrySpan(4), 1)
  equal(masonrySpan(5), 2)
  equal(masonrySpan(32), 8)
  equal(masonrySpan(33), 9)
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})
