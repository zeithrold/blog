import type { ReactNode } from 'react'
import type { Workspace } from '@/features/editor/core/editor-types'
import { CloudDownload, Laptop } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/ztd-me/client'
import { useBlogTranslation } from '@/i18n/use-translation'

const utility1Class = [
  'conflict-actions grid grid-cols-[repeat(auto-fit,_minmax(min(100%,_220px),_1fr))]',
  'items-stretch',
].join(' ')

const utility2Class = [
  '[&_.conflict-choice]:items-start [&_.conflict-choice]:gap-[10px] [&_.conflict-choice]:h-auto',
].join(' ')

const utility3Class = [
  '[&_.conflict-choice]:min-h-16 [&_.conflict-choice]:p-3 [&_.conflict-choice]:text-left',
].join(' ')

const utility4Class = [
  'conflict-choice-description text-muted-foreground text-[length:12px] font-normal leading-[1.5]',
].join(' ')

const utility5Class = [
  'conflict-choice-description text-muted-foreground text-[length:12px] font-normal leading-[1.5]',
].join(' ')

const utility6Class = [
  'conflict-choice [&_>_svg]:shrink-0 [&_>_svg]:mt-[2px] [&_>_svg]:text-muted-foreground',
].join(' ')

const utility7Class = [
  'conflict-choice [&_>_svg]:shrink-0 [&_>_svg]:mt-[2px] [&_>_svg]:text-muted-foreground',
].join(' ')

const layout1Class = [
  utility1Class,
  'gap-2 mt-3 pt-3 border-t border-border [&_.conflict-choice]:justify-start',
  utility2Class,
  utility3Class,
  '[&_.conflict-choice]:whitespace-normal',
].join(' ')

const layout2Class = [utility4Class, 'wrap-anywhere'].join(' ')

const layout3Class = [utility5Class, 'wrap-anywhere'].join(' ')

export function ConflictActions({ workspace, confirm, openServer }: {
  workspace: Workspace
  confirm: () => void
  openServer: () => void
}): ReactNode {
  const text = useBlogTranslation('editor').t
  const localDescriptionId = useId()
  const serverDescriptionId = useId()
  return (
    <div className={layout1Class}>
      <Button
        variant="outline"
        className={utility6Class}
        type="button"
        disabled={workspace.busy}
        aria-label={text('keepLocalEdits')}
        aria-describedby={localDescriptionId}
        onClick={(event) => {
          event.currentTarget.focus()
          confirm()
        }}
      >
        <Laptop size={18} aria-hidden="true" />
        <span className="conflict-choice-copy grid gap-[3px] min-w-0">
          <span className="conflict-choice-title text-[length:13px] font-medium leading-[1.5]">
            {text('keepLocalEdits')}
          </span>
          <span id={localDescriptionId} className={layout2Class}>
            {text('saveAsNewDraftRevision')}
          </span>
        </span>
      </Button>
      <Button
        variant="outline"
        className={utility7Class}
        type="button"
        disabled={workspace.busy}
        aria-label={text('useServerVersion')}
        aria-describedby={serverDescriptionId}
        onClick={openServer}
      >
        <CloudDownload size={18} aria-hidden="true" />
        <span className="conflict-choice-copy grid gap-[3px] min-w-0">
          <span className="conflict-choice-title text-[length:13px] font-medium leading-[1.5]">
            {text('useServerVersion')}
          </span>
          <span id={serverDescriptionId} className={layout3Class}>
            {text('localEditsStayInRecoveryCopy')}
          </span>
        </span>
      </Button>
    </div>
  )
}
