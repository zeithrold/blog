import type { ComponentProps } from '@blocknote/react'
import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Input, Label } from '@/components/ui/ztd-me/client'
import { cn } from '@/components/ui/ztd-me/ui/cn'

const template1Class = [
  'editor-option [&[data-selected=true]]:bg-muted [&[data-selected=true]]:[outline:none] flex',
  'items-center gap-[10px] min-h-14 p-2 rounded-[8px] cursor-pointer',
  '[transition:background-color_100ms_ease] hover:bg-muted',
].join(' ')

const utility1Class = [
  'editor-option-icon grid shrink-0 [place-items:center] w-8 h-8 border border-border',
  'rounded-[6px]',
].join(' ')

const utility2Class = [
  'editor-option-shortcut shrink-0 ml-auto py-[2px] px-[5px] border border-border rounded-[4px]',
].join(' ')

const layout1Class = [utility1Class, 'bg-card text-muted-foreground'].join(' ')

const layout2Class = [utility2Class, 'text-muted-foreground text-[length:11px] font-normal whitespace-nowrap'].join(' ')

export function FormRoot({
  children,
  onSubmit,
  submitButton,
}: ComponentProps['Generic']['Form']['Root']): ReactNode {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit?.()
      }}
    >
      {children}
      {submitButton !== 'none' ? submitButton : null}
    </form>
  )
}
export function FormTextInput({
  label,
  icon,
  rightSection,
  variant: _variant,
  ...rest
}: ComponentProps['Generic']['Form']['TextInput'] & { required?: boolean, maxLength?: number }): ReactNode {
  return (
    <Label className="editor-field grid gap-[6px] [&_span]:flex [&_span]:items-center [&_span]:gap-2">
      {label}
      <span>
        {icon}
        <Input {...rest} aria-label={label ?? rest.placeholder ?? rest.name} />
        {rightSection}
      </span>
    </Label>
  )
}
export function SuggestionItem({
  id,
  className,
  isSelected,
  onClick,
  item,
}: ComponentProps['SuggestionMenu']['Item']): ReactNode {
  const optionRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!isSelected) {
      return
    }
    const option = optionRef.current
    const menu = option?.closest('.editor-suggestions')
    if (option === null || !(menu instanceof HTMLElement)) {
      return
    }
    const optionBox = option.getBoundingClientRect()
    const menuBox = menu.getBoundingClientRect()
    const inset = 8
    if (optionBox.top < menuBox.top + inset) {
      menu.scrollTop += optionBox.top - menuBox.top - inset
    }
    else if (optionBox.bottom > menuBox.bottom - inset) {
      menu.scrollTop += optionBox.bottom - menuBox.bottom + inset
    }
  }, [isSelected])
  return (
    <div
      ref={optionRef}
      id={id}
      role="option"
      aria-selected={isSelected}
      className={cn(template1Class, className ?? '')}
      data-selected={isSelected}
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
    >
      <span className={layout1Class} aria-hidden="true">
        {item.icon ?? <Plus size={18} />}
      </span>
      <span className="editor-option-copy grid gap-[2px] min-w-0">
        <span className="editor-option-title text-help font-medium">{item.title}</span>
        {item.subtext !== undefined && item.subtext !== '' && (
          <small className="editor-option-description text-muted-foreground text-[length:12px] leading-[1.4]">
            {item.subtext}
          </small>
        )}
      </span>
      {item.badge !== undefined && item.badge !== '' && (
        <kbd className={layout2Class}>
          {item.badge}
        </kbd>
      )}
    </div>
  )
}
export function DisabledFeature(): never {
  throw new Error('This editor feature is disabled in the blog schema.')
}
