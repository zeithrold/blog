import type { ReactNode } from 'react'
import type { ReferenceEditorProps } from '@/features/editor/references/reference-exit'
import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { Dialog, DialogContent } from '@/components/ui/ztd-me/client'
import { ReferenceEditor } from '@/features/editor/references/reference-editor'
import { useReferenceEditor } from '@/features/editor/references/reference-exit'

export function ReferenceDialog(props: ReferenceEditorProps): ReactNode {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const controller = useReferenceEditor(props, editorRef)
  if (controller.page !== null) {
    return props.open && controller.page.outlet !== null
      ? createPortal(
          <ReferenceEditor editorRef={editorRef} controller={controller} creating={props.creating} />,
          controller.page.outlet,
        )
      : null
  }
  return (
    <Dialog open={props.open} onOpenChange={value => !value && controller.close()}>
      <DialogContent
        className="reference-dialog flex flex-col gap-0 overflow-hidden p-0 w-[min(640px,calc(100%-32px))]"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          editorRef.current
            ?.querySelector<HTMLInputElement>(`input[name="${props.creating ? 'doi' : 'title'}"]`)
            ?.focus()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          props.returnFocus()?.focus()
        }}
      >
        <ReferenceEditor editorRef={editorRef} controller={controller} creating={props.creating} />
      </DialogContent>
    </Dialog>
  )
}
