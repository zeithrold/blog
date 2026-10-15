import type { KeyboardEvent } from 'react'
import type { ChoiceOption } from '@/components/ui/choice-select'

type Navigation = {
  enabled: ChoiceOption[]
  activeValue: string | null
  setActiveValue: (value: string | null) => void
  choose: (value: string) => void
  options: ChoiceOption[]
  listId: string
}

function composing(event: KeyboardEvent<HTMLInputElement>): boolean {
  // Some IME commit events report 229 after compositionend, when isComposing is false.
  // eslint-disable-next-line ts/no-deprecated -- Retain the legacy IME commit signal for those browsers.
  return event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229
}

export function navigateSelect(event: KeyboardEvent<HTMLInputElement>, navigation: Navigation): void {
  if (composing(event)) {
    return
  }
  const { enabled, activeValue, setActiveValue, options, listId } = navigation
  if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault()
    const current = enabled.findIndex(option => option.value === activeValue)
    let next = current + 1
    if (event.key === 'ArrowUp') {
      next = current < 0 ? enabled.length - 1 : current - 1
    }
    const target = enabled[(next + enabled.length) % enabled.length]
    setActiveValue(target?.value ?? null)
    if (target !== undefined) {
      const index = options.findIndex(option => option.value === target.value)
      document.getElementById(`${listId}-${index}`)?.scrollIntoView({ block: 'nearest' })
    }
  }
  else if (event.key === 'Enter') {
    event.preventDefault()
    chooseFirstEnabled(navigation)
  }
}

function chooseFirstEnabled({ enabled, activeValue, choose }: Navigation): void {
  const target = enabled.find(option => option.value === activeValue) ?? enabled[0]
  if (target !== undefined) {
    choose(target.value)
  }
}
