import { act } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  all,
  click,
  one,
  press,
  typeText,
} from './dom'
import { advance, until } from './environment'
import {
  referenceDocument,
  referenceSaveRoute,
  writtenLists,
} from './references-stub'
import {
  authorForm,
  authorNames,
  clickLabeled,
  clickText,
  mountReferences,
  openReferenceList,
  pasteText,
  referenceEditor,
  referenceField,
  referenceForm,
  resetReferences,
} from './references-support'

afterEach(async () => {
  await resetReferences()
  vi.useRealTimers()
})

function startReference(width: number) {
  const view = mountReferences({
    initial: referenceDocument('Author list'),
    width,
    handlers: referenceSaveRoute,
  })
  openReferenceList(view)
  clickText(view.container, 'Add reference')
  return view
}

function authorSection(): HTMLElement {
  return one(referenceEditor(), '[data-slot="reference-authors"]')
}

function row(index: number): HTMLElement {
  const rows = all(referenceEditor(), '[data-author-row]')
  const target = rows[index]
  if (target === undefined) {
    throw new Error(`No author row at index ${index}`)
  }
  return target
}

async function addAuthor(value: string): Promise<void> {
  clickText(authorSection(), 'Add author')
  await until(() => referenceEditor().querySelector('[data-author-input]') !== null)
  typeText(one(authorForm(), '[data-author-input]'), value)
  clickText(authorForm(), 'Save')
  await until(() => referenceEditor().querySelector('[data-author-input]') === null)
}

async function openAuthor(index: number): Promise<void> {
  const name = one(row(index), '[data-author-name]')
  act(() => click(name))
  await until(() => referenceEditor().querySelector('[data-author-input]') !== null)
}

async function compactAction(index: number, label: string): Promise<void> {
  const trigger = one<HTMLButtonElement>(row(index), `button[aria-label="Author ${index + 1} actions"]`)
  press(trigger, 'Enter')
  await until(() => Array.from(document.body.querySelectorAll('[role="menuitem"]'))
    .some(item => item.textContent.replaceAll(/\s+/g, ' ').trim() === label))
  const item = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    .find(candidate => candidate.textContent.replaceAll(/\s+/g, ' ').trim() === label)
  if (item === undefined) {
    throw new Error(`No compact author action named "${label}"`)
  }
  press(item, 'Enter')
}

async function saveDraft(view: Awaited<ReturnType<typeof startReference>>): Promise<void> {
  await advance(2000)
  await view.api.expectServed()
}

for (const width of [390, 1440]) {
  it(`edits, reorders, pastes and saves author rows at ${width}px`, async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const view = startReference(width)
    typeText(referenceField('Reference title'), 'Author list interaction')
    await addAuthor('Ada Lovelace')
    await addAuthor('Grace Hopper')
    await addAuthor('Doe, Jane')

    await openAuthor(0)
    typeText(one(authorForm(), '[data-author-input]'), 'Augusta Ada King')
    clickText(authorForm(), 'Save')
    await until(() => referenceEditor().querySelector('[data-author-input]') === null)
    expect(authorNames(authorSection())).toEqual([
      'Augusta Ada King',
      'Grace Hopper',
      'Doe, Jane',
    ])

    const thirdHandle = one<HTMLButtonElement>(row(2), 'button[aria-label="Reorder author 3"]')
    press(thirdHandle, 'ArrowUp')
    expect(authorNames(authorSection())).toEqual([
      'Augusta Ada King',
      'Doe, Jane',
      'Grace Hopper',
    ])

    if (width < 1100) {
      await compactAction(1, 'Move author 2 up')
      await compactAction(1, 'Remove author 2')
    }
    else {
      clickLabeled(row(1), 'Move author 2 up')
      clickLabeled(row(1), 'Remove author 2')
    }
    expect(authorNames(authorSection())).toEqual(['Doe, Jane', 'Grace Hopper'])

    clickText(authorSection(), 'Add author')
    await until(() => referenceEditor().querySelector('[data-author-input]') !== null)
    pasteText(one(authorForm(), '[data-author-input]'), ' 张三\r\n\r\nResearch Institute ')
    await until(() => authorForm().querySelector('textarea[data-author-input]') !== null)
    clickText(authorForm(), 'Save')
    await until(() => referenceEditor().querySelector('[data-author-input]') === null)
    const expected = [
      'Doe, Jane',
      'Grace Hopper',
      '张三',
      'Research Institute',
    ]
    expect(authorNames(authorSection())).toEqual(expected)
    expect(view.api.calls.filter(call => call.method !== 'GET')).toEqual([])

    clickText(referenceForm(), 'Save')
    await until(() => document.body.querySelector('[data-slot="reference-editor"]') === null)
    expect(view.api.calls.filter(call => call.method !== 'GET')).toEqual([])
    await saveDraft(view)
    expect(writtenLists(view.api.calls)[0]?.[0]?.authors).toEqual(expected)
  })
}

it('enforces author limits while preserving duplicate rows and their identities', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const view = startReference(1440)
  typeText(referenceField('Reference title'), 'Author limits')
  await addAuthor('Duplicate')
  await addAuthor('Duplicate')

  clickText(authorSection(), 'Add author')
  await until(() => referenceEditor().querySelector('[data-author-input]') !== null)
  pasteText(one(authorForm(), '[data-author-input]'), `${'A'.repeat(201)}\nSecond`)
  await until(() => authorForm().querySelector('textarea[data-author-input]') !== null)
  clickText(authorForm(), 'Save')
  expect(authorForm().querySelector('[role="alert"]')?.textContent)
    .toBe('Enter 1–50 authors, with up to 200 characters each.')
  expect(authorNames(authorSection())).toEqual(['Duplicate', 'Duplicate'])

  typeText(one(authorForm(), '[data-author-input]'), 'Second')
  clickText(authorForm(), 'Save')
  await until(() => referenceEditor().querySelector('[data-author-input]') === null)

  const many = Array.from({ length: 48 }, (_value, index) => `Name ${index}`)
  clickText(authorSection(), 'Add author')
  await until(() => referenceEditor().querySelector('[data-author-input]') !== null)
  pasteText(one(authorForm(), '[data-author-input]'), many.join('\n'))
  await until(() => authorForm().querySelector('textarea[data-author-input]') !== null)
  clickText(authorForm(), 'Save')
  expect(authorForm().querySelector('[role="alert"]')?.textContent)
    .toBe('Enter 1–50 authors, with up to 200 characters each.')
  expect(authorNames(authorSection())).toHaveLength(3)

  typeText(one(authorForm(), '[data-author-input]'), many.slice(0, 47).join('\n'))
  clickText(authorForm(), 'Save')
  await until(() => referenceEditor().querySelector('[data-author-input]') === null)
  expect(authorNames(authorSection())).toHaveLength(50)

  clickText(authorSection(), 'Show fewer authors')
  expect(authorNames(authorSection())).toHaveLength(5)
  clickText(authorSection(), 'Show all 50 authors')
  expect(authorNames(authorSection())).toHaveLength(50)
  const second = one(row(1), '[data-author-name]')
  act(() => click(second))
  await until(() => referenceEditor().querySelector('[data-author-input]') !== null)
  typeText(one(authorForm(), '[data-author-input]'), 'Edited duplicate')
  clickText(authorForm(), 'Save')
  await until(() => referenceEditor().querySelector('[data-author-input]') === null)

  clickText(referenceForm(), 'Save')
  await until(() => document.body.querySelector('[data-slot="reference-editor"]') === null)
  await saveDraft(view)
  const saved = writtenLists(view.api.calls)[0]?.[0]?.authors
  expect(saved).toHaveLength(50)
  expect(saved?.[0]).toBe('Duplicate')
  expect(saved?.[1]).toBe('Edited duplicate')
  expect(saved?.[2]).toBe('Second')
})

it('preserves a reference draft while an author subpage is edited and discarded', async () => {
  const view = startReference(390)
  typeText(referenceField('Reference title'), 'Parent draft stays')
  await addAuthor('Ada Lovelace')
  await addAuthor('Grace Hopper')
  await openAuthor(1)
  expect(one(authorForm(), '[data-author-input]')).toHaveProperty('value', 'Grace Hopper')
  expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(1)

  typeText(one(authorForm(), '[data-author-input]'), 'Discard this name')
  clickLabeled(referenceEditor(), 'Back to reference')
  expect(referenceEditor().querySelector('[role="alert"]')?.textContent).toContain('Discard author changes?')
  clickText(referenceEditor(), 'Keep editing')
  expect(one(authorForm(), '[data-author-input]')).toHaveProperty('value', 'Discard this name')
  clickLabeled(referenceEditor(), 'Back to reference')
  clickText(referenceEditor(), 'Discard changes')
  await until(() => referenceEditor().querySelector('[data-author-input]') === null)
  expect(authorNames(authorSection())).toEqual(['Ada Lovelace', 'Grace Hopper'])
  expect(referenceField('Reference title')).toHaveProperty('value', 'Parent draft stays')

  clickText(authorSection(), 'Add author')
  await until(() => referenceEditor().querySelector('[data-author-input]') !== null)
  clickLabeled(referenceEditor(), 'Back to reference')
  await until(() => referenceEditor().querySelector('[data-author-input]') === null)
  expect(authorNames(authorSection())).toEqual(['Ada Lovelace', 'Grace Hopper'])
  clickText(authorSection(), 'Add author')
  await until(() => referenceEditor().querySelector('[data-author-input]') !== null)
  clickText(authorForm(), 'Save')
  expect(authorForm().querySelector('[role="alert"]')).not.toBeNull()
  clickText(authorForm(), 'Cancel')
  await until(() => referenceEditor().querySelector('[data-author-input]') === null)

  clickText(referenceForm(), 'Cancel')
  expect(referenceEditor().querySelector('[role="alert"]')?.textContent).toContain('Discard reference changes?')
  clickText(referenceEditor(), 'Discard changes')
  await until(() => document.body.querySelector('[data-slot="reference-editor"]') === null)
  expect(view.api.calls.filter(call => call.method !== 'GET')).toEqual([])
})
