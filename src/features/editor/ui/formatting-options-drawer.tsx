import type { ComponentProps, ReactNode } from 'react'
import type { EditorToolbarButtonProps } from '@/features/editor/ui/components-toolbar'
import { ComponentsContext, FormattingToolbar, PortalElementOverride, useDictionary } from '@blocknote/react'
import { ArrowLeft, Palette } from 'lucide-react'
import { use, useEffect, useRef, useState } from 'react'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Button, useFrontendPreferences } from '@/components/ui/ztd-me/client'
import { cn } from '@/components/ui/ztd-me/ui/cn'
import { editorComponents } from '@/features/editor/ui/components'
import { ToolbarButton } from '@/features/editor/ui/components-toolbar'
import { formattingItems } from '@/features/editor/ui/formatting-items'
import {
  ImmediateFormattingActionContext,
  useFormattingOptions,
} from '@/features/editor/ui/formatting-options-model'
import { FormattingTextColors } from '@/features/editor/ui/formatting-text-colors'
import { useBlogTranslation } from '@/i18n/use-translation'
import { loopDrawerOptionTab } from '@/shared/admin/drawer-keyboard'

const template1Class = [
  'formatting-drawer-option [&_>_svg]:flex-[0_0_18px] [&_>_svg]:w-[18px] [&_>_svg]:h-[18px]',
  '[&[aria-pressed=true]]:bg-muted',
].join(' ')

const utility1Class = [
  '[&_.editor-popover]:max-w-[calc(100vw_-_40px)] [&_.editor-side]:flex [&_.editor-side]:flex-col',
].join(' ')

const utility2Class = [
  '[&_.editor-side]:rounded-[10px] [&_.editor-side]:bg-card',
  '[&_.editor-side]:text-muted-foreground',
].join(' ')

const utility3Class = [
  '[&_.editor-side_.editor-side-button]:w-8 [&_.editor-side_.editor-side-button]:min-w-8',
].join(' ')

const utility4Class = [
  '[&_.editor-side_.editor-side-button]:h-8 [&_.editor-side_.editor-side-button]:min-h-8',
].join(' ')

const utility5Class = [
  '[&_.editor-side_.editor-side-button]:p-0 [&_.editor-side_.editor-side-button]:border-0',
].join(' ')

const utility6Class = [
  'max-[701px]:[&_.editor-side]:w-[50px] max-[701px]:[&_.editor-side_.editor-side-button]:w-11',
].join(' ')

const utility7Class = [
  'formatting-drawer-option [&_>_svg]:flex-[0_0_18px] [&_>_svg]:w-[18px] [&_>_svg]:h-[18px]',
].join(' ')

const utility8Class = ['[&_.formatting-drawer-option]:justify-start [&_.formatting-drawer-option]:gap-[10px]'].join(' ')

const utility9Class = [
  '[&_.formatting-drawer-option]:text-[length:13px]',
  '[&_.formatting-drawer-option]:whitespace-normal',
].join(' ')

const utility10Class = [
  'formatting-options-body min-h-0 pt-2 px-5 pb-5 overflow-y-auto [overscroll-behavior:contain]',
].join(' ')

const layout1Class = [
  'formatting-options-drawer blog-editor bn-root max-h-[min(680px,_86dvh)]',
  utility1Class,
  '[&_.editor-side]:gap-[2px] [&_.editor-side]:w-[38px] [&_.editor-side]:h-auto',
  '[&_.editor-side]:p-[2px] [&_.editor-side]:border [&_.editor-side]:border-border',
  utility2Class,
  '[&_.editor-side]:shadow-[0_2px_8px_var(--blog-shadow-overlay)]',
  utility3Class,
  utility4Class,
  utility5Class,
  '[&_.editor-side_.editor-side-button]:rounded-[7px]',
  '[&_.editor-side_.editor-side-button]:bg-transparent',
  '[&_.editor-side_.editor-side-button]:text-inherit',
  '[&_.editor-side_.editor-side-button]:[transition:background-color_120ms_ease,_color_120ms_ease]',
  'motion-reduce:[&_.editor-side_.editor-side-button]:transition-none',
  'motion-reduce:[&_.editor-side_.editor-side-button]:duration-0',
  '[&_.editor-side_.editor-side-button:hover]:bg-muted',
  '[&_.editor-side_.editor-side-button:hover]:text-foreground',
  '[&_.editor-side_.editor-side-button[data-state=open]]:bg-muted',
  '[&_.editor-side_.editor-side-button[data-state=open]]:text-foreground',
  utility6Class,
  'max-[701px]:[&_.editor-side_.editor-side-button]:min-w-11',
  'max-[701px]:[&_.editor-side_.editor-side-button]:h-11',
  'max-[701px]:[&_.editor-side_.editor-side-button]:min-h-11',
].join(' ')

const layout2Class = [utility7Class, '[&[aria-pressed=true]]:bg-muted'].join(' ')

const layout3Class = [
  'formatting-options-grid grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-2',
  utility8Class,
  '[&_.formatting-drawer-option]:w-full [&_.formatting-drawer-option]:min-w-0',
  '[&_.formatting-drawer-option]:min-h-11 [&_.formatting-drawer-option]:h-auto',
  '[&_.formatting-drawer-option]:py-[10px] [&_.formatting-drawer-option]:px-3',
  utility9Class,
].join(' ')

const drawerComponents = {
  ...editorComponents,
  FormattingToolbar: { ...editorComponents.FormattingToolbar, Root: DrawerToolbarRoot, Button: DrawerToolbarButton },
}

export function FormattingOptionsDrawer(): ReactNode {
  const options = useFormattingOptions()
  const text = useBlogTranslation('editor').t
  const { resolvedMode } = useFrontendPreferences()
  const [content, setContent] = useState<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const colors = options.page === 'colors'
  return (
    <Drawer open={options.open} onOpenChange={options.setOpen}>
      <DrawerContent
        ref={setContent}
        className={layout1Class}
        data-color-scheme={resolvedMode}
        onKeyDown={loopDrawerOptionTab}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          closeRef.current?.focus({ preventScroll: true })
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          options.afterClose()
        }}
      >
        <FormattingOptionsHeader />
        <div className={utility10Class} data-vaul-no-drag="">
          {content !== null && (
            <PortalElementOverride target={content}>
              <ComponentsContext value={drawerComponents}>
                {colors ? <FormattingTextColors /> : <DrawerFormattingActions />}
              </ComponentsContext>
            </PortalElementOverride>
          )}
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button ref={closeRef} type="button" variant="outline">{text('close')}</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function FormattingOptionsHeader(): ReactNode {
  const options = useFormattingOptions()
  const text = useBlogTranslation('editor').t
  const dictionary = useDictionary()
  const colors = options.page === 'colors'
  const backRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (colors && options.open) {
      backRef.current?.focus({ preventScroll: true })
    }
  }, [colors, options.open])
  return (
    <DrawerHeader>
      <div className="formatting-options-heading flex items-center gap-2">
        {colors && (
          <Button
            ref={backRef}
            type="button"
            size="icon"
            variant="ghost"
            aria-label={text('back')}
            onClick={() => options.setPage('actions')}
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </Button>
        )}
        <DrawerTitle>{colors ? dictionary.formatting_toolbar.colors.tooltip : text('formattingOptions')}</DrawerTitle>
      </div>
      <DrawerDescription>{text(colors ? 'chooseBlockColors' : 'applyFormattingToSelectedText')}</DrawerDescription>
    </DrawerHeader>
  )
}

function DrawerFormattingActions(): ReactNode {
  const options = useFormattingOptions()
  const dictionary = useDictionary()
  return (
    <FormattingToolbar>
      {formattingItems({}, true)}
      <Button
        type="button"
        variant="outline"
        className={layout2Class}
        onClick={() => options.setPage('colors')}
      >
        <Palette size={18} aria-hidden="true" />
        {dictionary.formatting_toolbar.colors.tooltip}
      </Button>
    </FormattingToolbar>
  )
}
function DrawerToolbarRoot({ children }: ComponentProps<typeof FormattingToolbar>): ReactNode {
  return (
    <div className={layout3Class}>
      {children}
    </div>
  )
}
function DrawerToolbarButton(props: EditorToolbarButtonProps): ReactNode {
  const options = useFormattingOptions()
  const immediate = use(ImmediateFormattingActionContext)
  const { onClick } = props
  const opensPanel = props['data-test'] !== 'createLink' && props['aria-haspopup'] !== undefined
  return (
    <ToolbarButton
      {...props}
      className={cn(template1Class, props.className ?? '')}
      onClick={onClick === undefined || opensPanel
        ? onClick
        : (event) => {
            if (immediate) {
              onClick(event)
              options.setOpen(false)
            }
            else {
              options.runAfterClose(onClick, event)
            }
          }}
    >
      {props.children ?? (
        <span className="formatting-option-label min-w-0 wrap-anywhere">
          {props.label ?? props.mainTooltip}
        </span>
      )}
    </ToolbarButton>
  )
}
