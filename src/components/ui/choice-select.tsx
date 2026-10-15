'use client'
import type { ComponentProps } from 'react'

import {
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/ztd-me/client'
import { cn } from '@/components/ui/ztd-me/ui/cn'

const template1Class = [
  'choice-select flex items-center justify-between gap-[10px] min-w-0 text-left text-control',
  'font-normal [&_>_span:first-child]:min-w-0 [&_>_span:first-child]:overflow-hidden',
  '[&_>_span:first-child]:[text-overflow:ellipsis] [&_>_span:first-child]:whitespace-nowrap',
].join(' ')

const layout1Class = [
  'choice-select-content z-[150] max-w-[calc(100vw_-_24px)] text-control',
  '[&_.ztd-select-item]:whitespace-normal [&_.ztd-select-item]:wrap-anywhere',
].join(' ')

export type ChoiceOption = { value: string, label: string, disabled?: boolean }
type TriggerFields
  = 'id' | 'disabled' | 'className' | 'aria-describedby' | 'aria-invalid' | 'onFocus' | 'contentEditable'
export type ChoiceSelectProps = Pick<ComponentProps<typeof SelectTrigger>, TriggerFields> & {
  value: string
  onValueChange: (value: string) => void
  options: ChoiceOption[]
  label: string
  placeholder?: string
}

// Encode empty choices as real values so clearing remains available in Radix Select.
export function ChoiceSelect({
  value,
  onValueChange,
  options,
  label,
  placeholder,
  className = '',
  ...props
}: ChoiceSelectProps): React.JSX.Element {
  return (
    <SelectRoot value={`choice:${value}`} onValueChange={next => onValueChange(next.slice(7))}>
      <SelectTrigger className={cn(template1Class, className)} aria-label={label} {...props}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={layout1Class} position="popper" sideOffset={6}>
        {options.map(option => (
          <SelectItem key={option.value} value={`choice:${option.value}`} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  )
}
