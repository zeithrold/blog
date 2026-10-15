'use client'

import type { KeyboardEvent, ReactNode } from 'react'
import type { ChoiceOption } from '@/components/ui/choice-select'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Search } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { navigateSelect } from '@/components/ui/searchable-select-navigation'
import { Button, Input } from '@/components/ui/ztd-me/client'
import { fieldClass, indicatorClass, menuClass, menuItemClass } from '@/components/ui/ztd-me/ui/classes'
import { cn } from '@/components/ui/ztd-me/ui/cn'
import { usePortalContainer } from '@/components/ui/ztd-me/ui/portal'

export type SearchableSelectProps = {
  id?: string
  label: string
  searchLabel: string
  placeholder: string
  emptyLabel: string
  loadingLabel: string
  clearLabel: string
  retryLabel: string
  options: ChoiceOption[]
  values: string[]
  onValuesChange: (values: string[]) => void
  onOpen?: () => void
  onRetry?: () => void
  multiple?: boolean
  disabled?: boolean
  loading?: boolean
  error?: string
}

const contentClass = [
  menuClass,
  'searchable-select-content z-[150] w-(--radix-popover-trigger-width)',
  'min-w-52 max-w-[calc(100vw_-_24px)] max-h-(--radix-popover-content-available-height)',
  'overflow-hidden',
].join(' ')
const triggerClass = [
  fieldClass,
  'ztd-select-trigger searchable-select-trigger flex items-center justify-between gap-2 text-left',
].join(' ')
const chipClass = 'max-w-full rounded-md bg-muted px-2 py-0.5 text-help wrap-anywhere'
const searchIconClass = ['pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground'].join(' ')

type SelectModel = {
  listId: string
  open: boolean
  query: string
  options: ChoiceOption[]
  active: number
  changeOpen: (next: boolean) => void
  changeQuery: (next: string) => void
  setActiveValue: (value: string | null) => void
  choose: (value: string) => void
  clear: () => void
  navigate: (event: KeyboardEvent<HTMLInputElement>) => void
}
type SelectViewProps = { props: SearchableSelectProps, model: SelectModel }
/** A searchable single or multiple Select with focus kept in the search combobox. */
export function SearchableSelect(props: SearchableSelectProps): ReactNode {
  const container = usePortalContainer()
  const inputRef = useRef<HTMLInputElement>(null)
  const model = useSearchableSelect(props)
  return (
    <Popover.Root open={model.open} onOpenChange={model.changeOpen}>
      <SelectTrigger props={props} model={model} />
      <Popover.Portal container={container}>
        <Popover.Content
          className={contentClass}
          sideOffset={6}
          collisionPadding={12}
          aria-label={props.label}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            inputRef.current?.focus()
          }}
        >
          <SearchInput props={props} model={model} inputRef={inputRef} />
          <SelectOptions props={props} model={model} />
          <SelectFeedback {...props} empty={model.options.length === 0} clear={model.clear} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function useSearchableSelect(props: SearchableSelectProps): SelectModel {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeValue, setActiveValue] = useState<string | null>(null)
  const needle = query.trim().toLocaleLowerCase()
  const options = props.options.filter(option => option.label.toLocaleLowerCase().includes(needle))
  const enabled = options.filter(option => option.disabled !== true && props.disabled !== true)
  const choose = (value: string): void => {
    if (props.disabled === true) {
      return
    }
    let values = [value]
    if (props.multiple === true) {
      values = props.values.includes(value)
        ? props.values.filter(item => item !== value)
        : [
            ...props.values,
            value,
          ]
    }
    props.onValuesChange(values)
    if (props.multiple !== true) {
      setOpen(false)
    }
  }
  const changeOpen = (next: boolean): void => {
    setOpen(next)
    if (next) {
      setQuery('')
      setActiveValue(null)
      props.onOpen?.()
    }
  }
  return {
    listId,
    open,
    query,
    options,
    choose,
    changeOpen,
    setActiveValue,
    active: options.findIndex(option => option.value === activeValue),
    changeQuery: (next) => {
      setQuery(next)
      setActiveValue(null)
    },
    clear: () => {
      props.onValuesChange([])
      if (props.multiple !== true) {
        setOpen(false)
      }
    },
    navigate: event => navigateSelect(event, { enabled, activeValue, setActiveValue, choose, options, listId }),
  }
}

function SelectTrigger({ props, model }: SelectViewProps): ReactNode {
  const selected = props.options.filter(option => props.values.includes(option.value))
  return (
    <Popover.Trigger asChild>
      <button
        id={props.id}
        type="button"
        className={triggerClass}
        role="combobox"
        aria-label={props.label}
        aria-expanded={model.open}
        aria-controls={model.listId}
        aria-haspopup="listbox"
        disabled={props.disabled}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            model.changeOpen(true)
          }
        }}
      >
        <span className="flex min-w-0 flex-wrap gap-1.5">
          {selected.length === 0
            ? <span className="text-muted-foreground">{props.placeholder}</span>
            : selected.map(option => (
                <span key={option.value} className={props.multiple === true ? chipClass : 'wrap-anywhere'}>
                  {option.label}
                </span>
              ))}
        </span>
        <ChevronDown size={16} className="shrink-0 opacity-65" aria-hidden="true" />
      </button>
    </Popover.Trigger>
  )
}

function SearchInput({
  props,
  model,
  inputRef,
}: SelectViewProps & { inputRef: React.RefObject<HTMLInputElement | null> }): ReactNode {
  return (
    <div className="relative mb-1.5">
      <Search size={16} className={searchIconClass} aria-hidden="true" />
      <Input
        ref={inputRef}
        role="combobox"
        aria-label={props.searchLabel}
        aria-expanded={model.open}
        aria-controls={model.listId}
        aria-autocomplete="list"
        aria-activedescendant={model.active < 0 ? undefined : `${model.listId}-${model.active}`}
        autoComplete="off"
        placeholder={props.searchLabel}
        className="ps-9"
        value={model.query}
        disabled={props.disabled}
        onChange={event => model.changeQuery(event.currentTarget.value)}
        onKeyDown={model.navigate}
      />
    </div>
  )
}

function SelectOptions({ props, model }: SelectViewProps): ReactNode {
  return (
    <div
      id={model.listId}
      role="listbox"
      aria-label={props.label}
      aria-multiselectable={props.multiple === true}
      className="max-h-64 overflow-y-auto"
    >
      {model.options.map((option, index) => (
        <button
          key={option.value}
          id={`${model.listId}-${index}`}
          type="button"
          role="option"
          tabIndex={-1}
          aria-selected={props.values.includes(option.value)}
          disabled={option.disabled === true || props.disabled === true}
          data-highlighted={model.active === index ? '' : undefined}
          className={cn(menuItemClass, 'w-full text-left disabled:opacity-50')}
          onPointerMove={() => option.disabled !== true && model.setActiveValue(option.value)}
          onMouseDown={event => event.preventDefault()}
          onClick={() => model.choose(option.value)}
        >
          <span className="min-w-0 wrap-anywhere">{option.label}</span>
          {props.values.includes(option.value) && (
            <span className={indicatorClass}><Check size={16} aria-hidden="true" /></span>
          )}
        </button>
      ))}
    </div>
  )
}

function SelectFeedback(props: SearchableSelectProps & { empty: boolean, clear: () => void }): ReactNode {
  const error = props.error ?? ''
  return (
    <>
      {props.loading === true && (
        <p className="m-0 px-3 py-2 text-help text-muted-foreground" role="status">{props.loadingLabel}</p>
      )}
      {error !== '' && (
        <div className="grid gap-2 px-3 py-2">
          <p className="m-0 text-help text-destructive" role="alert">{error}</p>
          <Button type="button" size="sm" variant="outline" disabled={props.loading} onClick={props.onRetry}>
            {props.retryLabel}
          </Button>
        </div>
      )}
      {props.empty && props.loading !== true && error === '' && (
        <p className="m-0 px-3 py-2 text-help text-muted-foreground" role="status">{props.emptyLabel}</p>
      )}
      {props.values.length > 0 && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="mt-1.5 w-full"
          disabled={props.disabled}
          onClick={props.clear}
        >
          {props.clearLabel}
        </Button>
      )}
    </>
  )
}
