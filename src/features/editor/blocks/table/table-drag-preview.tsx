import type { CSSProperties, ReactNode } from 'react'
import type { TableDragStore } from '@/features/editor/blocks/table/table-drag-store'
import { GripVertical } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useBlogTranslation } from '@/i18n/use-translation'

const serverSnapshot = (): null => null

export function TableDragPreview({ store, portalElement }: {
  store: TableDragStore
  portalElement: HTMLElement | null
}): ReactNode {
  const preview = useSyncExternalStore(store.subscribe, store.getSnapshot, serverSnapshot)
  const text = useBlogTranslation('editor').t
  if (preview === null) {
    return null
  }
  const bounds = (rect: typeof preview.source): CSSProperties => ({
    position: 'fixed',
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
  })
  const position = preview.boundary > preview.from ? preview.boundary : preview.boundary + 1
  const label = preview.valid
    ? text('tableDropPosition', { number: position })
    : text('tableDropInvalid')
  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[200]"
      data-table-drag-preview
      data-table-drag-valid={preview.valid}
      data-table-drop-boundary={preview.boundary}
    >
      {preview.source.width > 0 && (
        <div className="bg-focus/10 outline-1 outline-focus" style={bounds(preview.source)} />
      )}
      {preview.valid && <div className="rounded-full bg-focus" style={bounds(preview.line)} />}
      <div
        className="fixed flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1
        text-xs text-foreground shadow-sm"
        style={{
          left: Math.max(8, Math.min(window.innerWidth - 160, preview.point.x + 12)),
          top: Math.max(8, Math.min(window.innerHeight - 40, preview.point.y - 42)),
        }}
      >
        <GripVertical size={14} aria-hidden="true" />
        {label}
      </div>
    </div>,
    portalElement ?? document.body,
  )
}
