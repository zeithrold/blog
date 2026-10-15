'use client'

import type { ReactNode } from 'react'
import type { DropdownProps } from 'react-day-picker'
import * as Popover from '@radix-ui/react-popover'
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { DayPicker, getDefaultClassNames, useDayPicker } from 'react-day-picker'
import { enUS, zhCN } from 'react-day-picker/locale'
import { ChoiceSelect } from '@/components/ui/choice-select'
import { Button, useFrontendPreferences } from '@/components/ui/ztd-me/client'
import { usePortalContainer } from '@/components/ui/ztd-me/ui/portal'
import { useBlogTranslation } from '@/i18n/use-translation'

const utility1Class = ['calendar-popover z-[150] w-[min(328px,_calc(100vw_-_24px))] p-4 border border-border'].join(' ')

const utility2Class = ['[&_.rdp-month-caption]:mb-2 [&_.rdp-month-caption]:px-[42px] [&_.rdp-dropdowns]:flex'].join(' ')

const utility3Class = [
  '[&_.rdp-dropdowns]:items-center [&_.rdp-dropdowns]:justify-center [&_.rdp-dropdowns]:gap-2',
].join(' ')

const utility4Class = [
  '[&_.rdp-dropdowns]:min-h-11 [&_.calendar-choice]:w-auto [&_.calendar-choice]:min-h-10',
].join(' ')

const utility5Class = ['[&_.calendar-choice]:py-1 [&_.calendar-choice]:px-[6px] [&_.calendar-choice]:gap-1'].join(' ')

const utility6Class = [
  '[&_.calendar-choice]:border-0 [&_.calendar-choice]:text-[length:14px] [&_.rdp-nav]:absolute',
].join(' ')

const utility7Class = ['[&_.rdp-nav]:pointer-events-none [&_.rdp-nav_button]:p-0 [&_.rdp-nav_button]:w-10'].join(' ')

const utility8Class = [
  '[&_.rdp-nav_button]:min-w-10 [&_.rdp-nav_button]:border-0 [&_.rdp-nav_button]:bg-transparent',
].join(' ')

const utility9Class = [
  '[&_.rdp-day-button]:w-full [&_.rdp-day-button]:min-w-0 [&_.rdp-day-button]:min-h-[38px]',
].join(' ')

const utility10Class = [
  '[&_.rdp-day-button]:p-0 [&_.rdp-day-button]:border-0 [&_.rdp-day-button]:bg-transparent',
].join(' ')

const utility11Class = [
  '[&_.rdp-today:not(.rdp-selected)_.rdp-day-button]:font-semibold',
  '[&_.rdp-outside]:opacity-[0.45]',
].join(' ')

const layout1Class = [utility1Class, 'rounded-[12px] bg-card shadow-[0_12px_32px_var(--blog-shadow-overlay)]'].join(' ')

const layout2Class = [
  'app-calendar text-help [&_.rdp-months]:relative [&_.rdp-month-caption]:min-h-11',
  utility2Class,
  utility3Class,
  utility4Class,
  utility5Class,
  utility6Class,
  '[&_.rdp-nav]:[inset:0_0_auto] [&_.rdp-nav]:flex [&_.rdp-nav]:justify-between',
  utility7Class,
  utility8Class,
  '[&_.rdp-nav_button]:pointer-events-auto [&_.rdp-month-grid]:w-full',
  '[&_.rdp-month-grid]:[border-collapse:collapse] [&_.rdp-weekday]:h-8',
  '[&_.rdp-weekday]:text-muted-foreground [&_.rdp-weekday]:text-[length:12px]',
  '[&_.rdp-weekday]:font-normal [&_.rdp-day]:p-[2px] [&_.rdp-day]:text-center',
  utility9Class,
  utility10Class,
  '[&_.rdp-day-button]:text-[length:14px] [&_.rdp-day-button]:font-normal',
  '[&_.rdp-selected_.rdp-day-button]:bg-primary',
  '[&_.rdp-selected_.rdp-day-button]:text-[var(--ztd-action-foreground)]',
  '[&_.rdp-today:not(.rdp-selected)_.rdp-day-button]:bg-muted',
  utility11Class,
  '[&_.rdp-disabled]:opacity-[0.45]',
].join(' ')

const calendarClasses = Object.fromEntries(Object.entries(getDefaultClassNames())
  .map(([key, value]) => [
    key,
    value.replaceAll('_', '-'),
  ]))

export function DatePicker({ value, onValueChange, label, disabled }: {
  value: string
  onValueChange: (value: string) => void
  label: string
  disabled?: boolean
}): ReactNode {
  const [open, setOpen] = useState(false)
  const { preferences } = useFrontendPreferences()
  const text = useBlogTranslation('editor').t
  const container = usePortalContainer()
  const selected = parseCalendarDate(value)
  const chinese = preferences.locale === 'zh-CN'
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          className="date-picker-trigger w-full justify-between px-3 text-left"
          variant="outline"
          disabled={disabled}
          aria-label={label}
        >
          <span>
            {selected === undefined
              ? text('pickADate')
              : new Intl.DateTimeFormat(preferences.locale, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                }).format(selected)}
          </span>
          <CalendarIcon size={16} aria-hidden="true" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Content
          className={layout1Class}
          align="start"
          sideOffset={6}
          aria-label={text('choosePublicationDate')}
        >
          <PublicationCalendar
            selected={selected}
            chinese={chinese}
            onSelect={(date) => {
              onValueChange(formatCalendarDate(date))
              setOpen(false)
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
function PublicationCalendar({ selected, chinese, onSelect }: {
  selected: Date | undefined
  chinese: boolean
  onSelect: (date: Date) => void
}): React.JSX.Element {
  const text = useBlogTranslation('editor').t
  return (
    <DayPicker
      className={layout2Class}
      classNames={calendarClasses}
      mode="single"
      selected={selected}
      defaultMonth={selected}
      locale={chinese ? zhCN : enUS}
      captionLayout="dropdown"
      startMonth={new Date(2020, 0)}
      endMonth={new Date(2120, 11)}
      autoFocus
      components={{ Chevron: CalendarChevron, MonthsDropdown: CalendarMonths, YearsDropdown: CalendarYears }}
      labels={{ labelNext: () => text('nextMonth'), labelPrevious: () => text('previousMonth') }}
      onSelect={(date) => {
        if (date !== undefined) {
          onSelect(date)
        }
      }}
    />
  )
}
function CalendarMonths(props: DropdownProps): React.JSX.Element {
  return <CalendarDropdown {...props} part="month" />
}
function CalendarYears(props: DropdownProps): React.JSX.Element {
  return <CalendarDropdown {...props} part="year" />
}
function CalendarDropdown({ options, value, disabled, part }: DropdownProps & {
  part: 'month' | 'year'
}): React.JSX.Element {
  const { months, goToMonth } = useDayPicker()
  const text = useBlogTranslation('editor').t
  return (
    <ChoiceSelect
      className="calendar-choice"
      label={text(part === 'month' ? 'chooseMonth' : 'chooseYear')}
      disabled={disabled}
      value={String(value)}
      options={(options ?? []).map(option => ({ ...option, value: String(option.value) }))}
      onValueChange={(next) => {
        const date = new Date(months[0]?.date ?? new Date())
        date.setDate(1)
        if (part === 'month') {
          date.setMonth(Number(next))
        }
        else {
          date.setFullYear(Number(next))
        }
        goToMonth(date)
      }}
    />
  )
}
function CalendarChevron({ orientation }: { orientation?: string }): React.JSX.Element {
  return orientation === 'left'
    ? <ChevronLeft size={16} aria-hidden="true" />
    : <ChevronRight size={16} aria-hidden="true" />
}
function parseCalendarDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined
  }
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return formatCalendarDate(date) === value ? date : undefined
}
function formatCalendarDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
