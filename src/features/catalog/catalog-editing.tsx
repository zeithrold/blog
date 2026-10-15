import type { ReactNode } from 'react'
import type { CatalogEntry, useCatalogManager } from '@/features/catalog/catalog-model'
import { useRouter } from 'next/navigation'
import { useCallback, useRef, useState } from 'react'
import { ConfirmDialog } from '@/features/editor/ui/confirm'
import { useEditorLabels } from '@/i18n/use-labels'
import { useInternalNavigationGuard } from '@/shared/admin/navigation-guard-context'

type NavigationTarget = { href: string }
type Pending = { item: CatalogEntry | null } | NavigationTarget
type Model = ReturnType<typeof useCatalogManager>

export function useCatalogEditing(model: Model): {
  edit: (item: CatalogEntry | null) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  confirmation: ReactNode
} {
  const text = useEditorLabels()
  const router = useRouter()
  const [pending, setPending] = useState<Pending | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const discardedRef = useRef(false)
  const navigate = useCallback((href: string) => {
    discardedRef.current = false
    setPending({ href })
  }, [])
  useInternalNavigationGuard(model.dirty || model.busy, navigate)
  const edit = (item: CatalogEntry | null): void => {
    if (model.dirty) {
      discardedRef.current = false
      setPending({ item })
      return
    }
    model.begin(item)
    inputRef.current?.focus()
  }
  const accept = (): void => {
    if (pending === null || model.busy) {
      return
    }
    discardedRef.current = 'item' in pending
    model.begin('item' in pending ? pending.item : null)
    setPending(null)
    if ('href' in pending) {
      router.push(pending.href)
    }
  }
  return {
    edit,
    inputRef,
    confirmation: pending === null
      ? null
      : (
          <ConfirmDialog
            title={text('href' in pending ? 'Leave the catalog editor?' : 'Discard unsaved catalog changes?')}
            description={'href' in pending
              ? text('Unsaved form changes will be discarded. Saved catalog entries will remain.')
              : undefined}
            pending={model.busy}
            close={() => setPending(null)}
            accept={accept}
            returnFocus={() => restoreFocus(discardedRef.current, inputRef.current, pending)}
          />
        ),
  }
}

function restoreFocus(discarded: boolean, input: HTMLInputElement | null, pending: Pending): HTMLElement | null {
  if (discarded) {
    return input
  }
  const trigger = document.querySelector<HTMLElement>('.workspace-navigation-mobile')
  return 'href' in pending && trigger !== null && trigger.getClientRects().length > 0 ? trigger : null
}
