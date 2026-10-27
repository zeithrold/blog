'use client'

import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, X } from 'lucide-react'
import { Toaster } from 'sonner'
import { useFrontendPreferences } from '@/components/ui/ztd-me/client'
import { useEditorLabels } from '@/i18n/use-labels'

export function BlogToaster(): ReactNode {
  const { preferences } = useFrontendPreferences()
  const text = useEditorLabels()
  return (
    <Toaster
      theme={preferences.mode}
      position="bottom-right"
      duration={3000}
      closeButton
      containerAriaLabel={text('Notifications')}
      icons={{
        success: <CircleCheck size={18} aria-hidden="true" />,
        error: <CircleAlert size={18} aria-hidden="true" />,
        close: <X size={14} aria-hidden="true" />,
      }}
      style={{ fontFamily: 'inherit' }}
      toastOptions={{
        closeButtonAriaLabel: text('Close'),
        style: {
          background: 'var(--ztd-surface)',
          color: 'var(--ztd-foreground)',
          borderColor: 'var(--ztd-border)',
          fontSize: 'var(--ztd-font-control)',
        },
      }}
    />
  )
}
