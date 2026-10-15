'use client'
import type { ReactNode } from 'react'
import { useSiteLocale, useSiteText } from '@/i18n/site-locale'

export function SiteText({ value }: { value: string }): ReactNode {
  return useSiteText()(value)
}

export function SiteCount({
  count,
  one,
  other,
}: {
  count: number
  one: string
  other: string
}): ReactNode {
  const text = useSiteText()
  return text(count === 1 ? one : other, { count })
}

export function SiteDate({ value }: { value: number }): ReactNode {
  const locale = useSiteLocale()
  const date = new Date(value)
  // UTC keeps the Worker render and browser hydration on the same calendar day.
  return (
    <time dateTime={date.toISOString()}>
      {new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(date)}
    </time>
  )
}
