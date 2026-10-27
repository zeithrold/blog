/*
 * The measured grid rule: cards keep DOM order, and each item only records how
 * many fine rows it needs. Items carry their own vertical gap as bottom padding,
 * so a span of N rows covers N*height and column spacing stays tight.
 */
export const FEED_ROW_HEIGHT = 4

export function masonrySpan(height: number): number {
  return Math.max(1, Math.ceil(height / FEED_ROW_HEIGHT))
}
