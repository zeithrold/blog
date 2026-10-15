import { Problem } from '@/server/problem'

export type TimeChoice = {
  runAt: number
  utcOffset: number
}

export function timeChoices(localTime: string, timezone: string): TimeChoice[] {
  const nominal = Date.parse(`${localTime}:00Z`)
  if (
    !Number.isFinite(nominal)
    || new Date(nominal).toISOString().slice(0, 16) !== localTime
  ) {
    throw new Problem(400, 'SCHEDULE_TIME_INVALID')
  }
  let formatter: Intl.DateTimeFormat
  try {
    formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
  }
  catch {
    throw new Problem(400, 'TIMEZONE_INVALID')
  }
  const offsets = new Set<number>()
  for (const delta of [
    -86400000,
    0,
    86400000,
  ]) {
    const stamp = nominal + delta
    const shown = formatter.format(stamp).replace(' ', 'T')
    offsets.add((Date.parse(`${shown}:00Z`) - stamp) / 60000)
  }
  return Array.from(offsets)
    .map(utcOffset => ({
      utcOffset,
      runAt: nominal - utcOffset * 60000,
    }))
    .filter(choice => formatter.format(choice.runAt).replace(' ', 'T') === localTime)
    .sort((left, right) => left.runAt - right.runAt)
    .slice(0, 2)
}
