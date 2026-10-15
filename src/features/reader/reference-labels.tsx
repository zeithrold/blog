'use client'
import type { ReactNode } from 'react'
import { useBlogTranslation } from '@/i18n/use-translation'

export function ReferenceSection({ name, children }: {
  name: 'footnotes' | 'references'
  children: ReactNode
}): ReactNode {
  const { t } = useBlogTranslation('site')
  return (
    <section aria-label={t(name)}>
      <h2>{t(name)}</h2>
      {children}
    </section>
  )
}

export function FootnoteReturn({ anchor, number }: { anchor: string, number: number }): ReactNode {
  const { t } = useBlogTranslation('site')
  return <a href={`#${anchor}`} aria-label={t('returnFromFootnote', { number })}>↩</a>
}
