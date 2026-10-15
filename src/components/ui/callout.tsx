'use client'

import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { calloutLabels, calloutTones } from '@/components/ui/callout-tones'
import { useBlogTranslation } from '@/i18n/use-translation'

const icons = { info: Info, warning: TriangleAlert, success: CircleCheck, danger: CircleAlert }
const headerClass = 'callout-header flex min-h-8 items-center gap-2 font-sans text-control font-medium'

export function Callout({ tone, header, children }: {
  tone: string
  header?: ReactNode
  children: ReactNode
}): React.JSX.Element {
  const { t } = useBlogTranslation('editor')
  const resolvedTone = calloutTones.find(value => value === tone) ?? 'info'
  const Icon = icons[resolvedTone]
  return (
    <aside className="callout my-4 grid w-full min-w-0 gap-2 rounded-xl border p-4" data-tone={resolvedTone}>
      <div className={headerClass} contentEditable={false}>
        <Icon className="callout-icon shrink-0" size={18} aria-hidden="true" />
        {header ?? <span className="capitalize">{t(calloutLabels[resolvedTone])}</span>}
      </div>
      {children}
    </aside>
  )
}
