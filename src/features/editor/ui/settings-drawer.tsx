import type { ReactNode, RefObject } from 'react'
import { Settings2 } from 'lucide-react'
import { useRef } from 'react'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Button } from '@/components/ui/ztd-me/client'
import { ReferencePageContext, useReferencePageHost } from '@/features/editor/services/reference-page'
import { useEditorLabels } from '@/i18n/use-labels'
import { layout1Class, layout2Class, layout3Class } from './settings-layout'

type Props = {
  children: ReactNode
  open: boolean
  uploading: boolean
  changeOpen: (open: boolean) => void
  revealRef: RefObject<(() => void) | null>
}
export function SettingsDrawer({ children, open, uploading, changeOpen, revealRef }: Props): ReactNode {
  const text = useEditorLabels()
  const contentRef = useRef<HTMLDivElement | null>(null)
  const { active, host, setOutlet, requestBack } = useReferencePageHost(contentRef)
  const focusProblem = (event: { preventDefault: () => void }): void => {
    const reveal = revealRef.current
    revealRef.current = null
    if (reveal !== null) {
      event.preventDefault()
      reveal()
    }
  }
  const close = (): void => active ? requestBack() : changeOpen(false)
  return (
    <ReferencePageContext value={host}>
      <div className={layout1Class}>
        <Drawer
          open={open}
          onOpenChange={value => value ? changeOpen(true) : close()}
          dismissible={!uploading && !active}
        >
          <DrawerTrigger asChild>
            <Button type="button" variant="outline">
              <Settings2 size={18} aria-hidden="true" />
              {text('Document settings')}
            </Button>
          </DrawerTrigger>
          <DrawerContent
            ref={contentRef}
            className={layout2Class}
            onCloseAutoFocus={focusProblem}
            {...(active ? { 'aria-labelledby': host.titleId, 'aria-describedby': host.descriptionId } : {})}
            onEscapeKeyDown={(event) => {
              if (active) {
                event.preventDefault()
                requestBack()
              }
            }}
          >
            <SettingsHome hidden={active} uploading={uploading} close={() => changeOpen(false)}>
              {children}
            </SettingsHome>
            <div
              ref={setOutlet}
              hidden={!active}
              data-slot="reference-page-outlet"
              className="flex min-h-0 flex-1 flex-col data-[active=false]:hidden"
              data-active={active}
            />
          </DrawerContent>
        </Drawer>
      </div>
    </ReferencePageContext>
  )
}
function SettingsHome({ hidden, children, uploading, close }: {
  hidden: boolean
  children: ReactNode
  uploading: boolean
  close: () => void
}): ReactNode {
  const text = useEditorLabels()
  return (
    <div hidden={hidden} data-hidden={hidden} className="flex min-h-0 flex-1 flex-col data-[hidden=true]:hidden">
      <div className="inspector-drawer-header shrink-0 pt-5 px-6 pb-4 text-left">
        <DrawerTitle>{text('Document settings')}</DrawerTitle>
        <DrawerDescription>{text('Manage document information and publication.')}</DrawerDescription>
      </div>
      {children}
      <div className={layout3Class}>
        <Button type="button" variant="outline" className="inspector-close w-full" disabled={uploading} onClick={close}>
          {text('Close')}
        </Button>
      </div>
    </div>
  )
}
