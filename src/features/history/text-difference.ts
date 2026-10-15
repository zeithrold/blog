// Bound the highlighted region with common Unicode code points. Work is linear,
// even for large paragraphs, and never splits a surrogate pair.
export function changedTextRange(before: string, after: string): {
  prefix: string
  removed: string
  added: string
  suffix: string
} {
  const previous = Array.from(before)
  const next = Array.from(after)
  let start = 0
  while (start < previous.length && start < next.length && previous[start] === next[start]) {
    start++
  }
  let end = 0
  while (end < previous.length - start && end < next.length - start
    && previous[previous.length - 1 - end] === next[next.length - 1 - end]) {
    end++
  }
  return {
    prefix: previous.slice(0, start).join(''),
    removed: previous.slice(start, previous.length - end).join(''),
    added: next.slice(start, next.length - end).join(''),
    suffix: end === 0 ? '' : previous.slice(previous.length - end).join(''),
  }
}
