import type { ReactNode } from 'react'
import { useRef } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/ztd-me/client'
import { useEditorLabels } from '@/i18n/use-labels'

export function ConfirmDialog({ title, close, accept, returnFocus, description, pending = false }: {
  title: string
  close: () => void
  accept: () => void
  returnFocus?: () => HTMLElement | null
  description?: string
  pending?: boolean
}): ReactNode {
  const text = useEditorLabels()
  const priorRef = useRef<Element | null>(typeof document === 'undefined' ? null : document.activeElement)
  const details = pending
    ? text('Wait for the current save to finish before continuing.')
    : description ?? text('Review this action before continuing.')
  return (
    <Dialog open onOpenChange={open => !open && close()}>
      <DialogContent onCloseAutoFocus={(event) => {
        event.preventDefault()
        const target = returnFocus?.() ?? priorRef.current
        if (target instanceof HTMLElement && target.isConnected) {
          // A newer menu may have opened while this dialog was closing.
          if (target.getAttribute('aria-haspopup') === 'menu' && target.getAttribute('aria-expanded') === 'true') {
            return
          }
          target.focus()
        }
      }}
      >
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <DialogDescription>
          {details}
        </DialogDescription>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>{text('Cancel')}</Button>
          <Button type="button" disabled={pending} onClick={accept}>{text(pending ? 'Saving…' : 'Confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
