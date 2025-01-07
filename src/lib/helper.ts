import humanizeDuration from 'humanize-duration'

export function humanTime(date: Date, mode: 'full' | 'compact' = 'compact') {
  if (mode === 'full') {
    return date.toLocaleString()
  }
  const current = new Date()
  const duration = current.getTime() - date.getTime()
  const humanized
    = duration < 60 * 1000
      ? 'just now'
      : `${humanizeDuration(duration, { largest: 1, round: true })} ago`
  return humanized
}
