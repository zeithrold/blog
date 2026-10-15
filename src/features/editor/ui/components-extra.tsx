import type { ComponentProps } from '@blocknote/react'
import type { ReactNode } from 'react'
import { SideMenuExtension } from '@blocknote/core/extensions'
import { useExtensionState } from '@blocknote/react'
import * as Menu from '@radix-ui/react-dropdown-menu'
import * as Popover from '@radix-ui/react-popover'
import { LoaderCircle } from 'lucide-react'
import { ButtonGroup } from '@/components/ui/button-group'
import { Button, Input } from '@/components/ui/ztd-me/client'
import { cn } from '@/components/ui/ztd-me/ui/cn'
import { useBlogTranslation } from '@/i18n/use-translation'

const template1Class = [
  'editor-side [&_.editor-side-button[draggable=\'true\']]:[cursor:grab]',
  '[&_.editor-side-button[draggable=\'true\']:active]:[cursor:grabbing]',
  'h-auto gap-0.5 border-0 bg-transparent p-0 shadow-none text-muted-foreground/70',
  '[&>.editor-side-button]:rounded-md',
  '[&_.editor-side-button]:size-8 [&_.editor-side-button]:min-w-8 [&_.editor-side-button]:min-h-8',
  '[&_.editor-side-button]:p-0 [&_.editor-side-button]:bg-transparent [&_.editor-side-button]:text-inherit',
  '[&_.editor-side-button:hover]:bg-muted [&_.editor-side-button:hover]:text-foreground',
  '[&_.editor-side-button[data-state=open]]:bg-muted [&_.editor-side-button[data-state=open]]:text-foreground',
  'max-[701px]:[&_.editor-side-button]:size-11 max-[701px]:[&_.editor-side-button]:min-w-11',
  'max-[701px]:[&_.editor-side-button]:min-h-11',
  'max-[701px]:[&_.editor-side-button:hover]:bg-transparent',
  'max-[701px]:[&_.editor-side-button[data-state=open]]:bg-transparent',
  'max-[701px]:[&_.editor-side-button:hover_.editor-side-glyph]:bg-muted',
  'max-[701px]:[&_.editor-side-button:focus-visible_.editor-side-glyph]:bg-muted',
  'max-[701px]:[&_.editor-side-button[data-state=open]_.editor-side-glyph]:bg-muted',
  'motion-reduce:[&_.editor-side-button]:transition-none motion-reduce:[&_.editor-side-button]:duration-0',
].join(' ')

const template2Class = [
  'editor-suggestions p-1 border border-border rounded-[12px] bg-card text-foreground',
  'shadow-[0_12px_32px_var(--blog-shadow-overlay)]',
].join(' ')

const template3Class = [
  'editor-suggestions-label mt-2 pt-1 px-2 pb-[6px] text-muted-foreground text-[length:12px]',
  'font-medium [&:first-child]:mt-0',
].join(' ')

const template4Class = [
  'editor-suggestions-empty flex items-center gap-2 py-3 px-2 text-muted-foreground text-help',
].join(' ')

const template5Class = [
  'editor-suggestions-loader flex items-center gap-2 py-3 px-2 text-muted-foreground text-help',
].join(' ')

export function GenericMenuDivider({
  className,
}: ComponentProps['Generic']['Menu']['Divider']): ReactNode {
  return <Menu.Separator className={cn('my-1 h-px bg-border', className)} />
}
export function GenericMenuLabel({
  className,
  children,
}: ComponentProps['Generic']['Menu']['Label']): ReactNode {
  return <Menu.Label className={cn('px-3 py-1.5 text-help text-muted-foreground', className)}>{children}</Menu.Label>
}
export function GenericPopoverTrigger({
  children,
}: ComponentProps['Generic']['Popover']['Trigger']): ReactNode {
  return <Popover.Trigger asChild>{children}</Popover.Trigger>
}
export function GenericBadgeRoot({
  text,
  icon,
  isSelected,
  mainTooltip,
  secondaryTooltip,
  ...rest
}: ComponentProps['Generic']['Badge']['Root']): ReactNode {
  return (
    <Button
      variant="outline"
      {...rest}
      type="button"
      title={[mainTooltip, secondaryTooltip].filter(Boolean).join(' · ')}
      aria-pressed={isSelected}
    >
      {icon}
      {text}
    </Button>
  )
}
export function GenericBadgeGroup({
  className,
  children,
}: ComponentProps['Generic']['Badge']['Group']): ReactNode {
  return <div className={className}>{children}</div>
}
export function SideMenuRoot({
  className,
  children,
}: ComponentProps['SideMenu']['Root']): ReactNode {
  const block = useExtensionState(SideMenuExtension, { selector: state => state?.block })
  return (
    <ButtonGroup
      orientation="horizontal"
      data-block-id={block?.id}
      data-block-type={block === undefined ? undefined : String(block.type)}
      className={cn(template1Class, block?.type === 'table' && 'min-[701px]:translate-y-2', className ?? '')}
    >
      {children}
    </ButtonGroup>
  )
}
export function SuggestionMenuRoot({
  id,
  className,
  children,
}: ComponentProps['SuggestionMenu']['Root']): ReactNode {
  const { t } = useBlogTranslation('editor')
  return (
    <div id={id} role="listbox" aria-label={t('insertBlock')} className={cn(template2Class, className ?? '')}>
      {children}
    </div>
  )
}
export function SuggestionMenuLabel({
  className,
  children,
}: ComponentProps['SuggestionMenu']['Label']): ReactNode {
  return (
    <div className={cn(template3Class, className ?? '')} role="presentation">
      {children}
    </div>
  )
}
export function SuggestionMenuEmptyItem({
  className,
  children,
}: ComponentProps['SuggestionMenu']['EmptyItem']): ReactNode {
  return (
    <div className={cn(template4Class, className ?? '')} role="status">
      {children}
    </div>
  )
}
export function SuggestionMenuLoader({
  className,
}: ComponentProps['SuggestionMenu']['Loader']): ReactNode {
  const { t } = useBlogTranslation('editor')
  return (
    <div className={cn(template5Class, className ?? '')} role="status">
      <LoaderCircle size={16} aria-hidden="true" />
      {t('loading')}
    </div>
  )
}
export function TableHandleRoot({
  label,
  children,
  className,
  ...rest
}: ComponentProps['TableHandle']['Root']): ReactNode {
  const { t } = useBlogTranslation('editor')
  return (
    <Button
      variant="outline"
      size="icon-xs"
      className={cn('min-w-8 shadow-menu', className)}
      {...rest}
      type="button"
      aria-label={label ?? t('tableControls')}
    >
      {children}
    </Button>
  )
}
export function TableHandleExtendButton({
  children,
  className,
  ...rest
}: ComponentProps['TableHandle']['ExtendButton']): ReactNode {
  return (
    <Button variant="outline" size="icon-xs" className={cn('min-w-8', className)} {...rest} type="button">
      {children}
    </Button>
  )
}
export function FilePanelButton({
  label,
  children,
  ...rest
}: ComponentProps['FilePanel']['Button']): ReactNode {
  return (
    <Button variant="outline" {...rest} type="button" aria-label={label}>
      {children}
    </Button>
  )
}
export function FilePanelTabPanel({
  children,
  ...rest
}: ComponentProps['FilePanel']['TabPanel']): ReactNode {
  return <div {...rest}>{children}</div>
}
export function FilePanelFileInput({
  onChange,
  accept,
  className,
  placeholder,
}: ComponentProps['FilePanel']['FileInput']): ReactNode {
  return (
    <input
      type="file"
      accept={accept}
      className={className}
      aria-label={placeholder}
      onChange={event => onChange(event.currentTarget.files?.[0] ?? null)}
    />
  )
}
export function FilePanelTextInput({
  placeholder,
  ...rest
}: ComponentProps['FilePanel']['TextInput']): ReactNode {
  return <Input {...rest} placeholder={placeholder} aria-label={placeholder} />
}
