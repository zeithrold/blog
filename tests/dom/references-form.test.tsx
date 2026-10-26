import { act } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { click, field, one, texts, typeText } from './dom'
import { advance, until } from './environment'
import {
  citedReferenceDocument,
  referenceDocument,
  referenceSaveRoute,
  writtenLists,
} from './references-stub'
import {
  authorForm,
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

function authorSection(): HTMLElement {
  return one(referenceEditor(), '[data-slot="reference-authors"]')
}

async function addAuthors(value: string): Promise<void> {
  clickText(authorSection(), 'Add author')
  await until(() => referenceEditor().querySelector('[data-author-input]') !== null)
  pasteText(one(authorForm(), '[data-author-input]'), value)
  await until(() => authorForm().querySelector('textarea[data-author-input]') !== null)
  clickText(authorForm(), 'Save')
  await until(() => referenceEditor().querySelector('[data-author-input]') === null)
}

async function settleWrite(view: ReturnType<typeof mountReferences>): Promise<void> {
  await advance(2000)
  await view.api.expectServed()
}

async function createReference(
  view: ReturnType<typeof mountReferences>,
  list: HTMLElement,
): Promise<string> {
  clickText(view.container, 'Add reference')
  typeText(referenceField('Reference title'), ' A Treatise on Reference Management ')
  await addAuthors(' Ada Lovelace\n\n Grace Hopper ')
  typeText(referenceField('Year'), '2026.5')
  typeText(referenceField('DOI'), 'invalid')
  typeText(referenceField('URL'), 'javascript:alert(1)')
  clickText(referenceForm(), 'Save')
  expect(referenceForm().querySelectorAll('[role="alert"]')).toHaveLength(3)
  const invalidFields = [
    'Year',
    'DOI',
    'URL',
  ]
  for (const name of invalidFields) {
    expect(field(referenceForm(), name).getAttribute('aria-invalid')).toBe('true')
  }
  expect(view.api.calls.filter(call => call.method !== 'GET')).toEqual([])

  typeText(referenceField('Year'), '2026')
  typeText(referenceField('DOI'), '10.1000/example')
  typeText(referenceField('URL'), 'https://example.com/paper')
  clickText(referenceForm(), 'Save')
  await until(() => document.body.querySelector('[data-slot="reference-editor"]') === null)
  await settleWrite(view)
  const created = writtenLists(view.api.calls)[0]?.[1]
  expect(created).toMatchObject({
    title: 'A Treatise on Reference Management',
    authors: ['Ada Lovelace', 'Grace Hopper'],
    year: 2026,
    doi: '10.1000/example',
    url: 'https://example.com/paper',
  })
  if (created === undefined) {
    throw new Error('The revision packet omitted its new reference')
  }
  expect(one(list, '.reference-item').textContent).toContain('Attention Is All You Need')
  expect(list.querySelectorAll('.reference-item')).toHaveLength(2)
  return created.id
}

async function cancelReferenceEdit(view: ReturnType<typeof mountReferences>, list: HTMLElement): Promise<void> {
  clickLabeled(list, 'Edit reference: A Treatise on Reference Management')
  typeText(referenceField('Reference title'), 'Cancelled edit')
  clickText(referenceForm(), 'Cancel')
  clickText(referenceEditor(), 'Discard changes')
  await until(() => document.body.querySelector('[data-slot="reference-editor"]') === null)
  expect(writtenLists(view.api.calls)).toHaveLength(1)
}

async function renameAndRemoveReference(
  view: ReturnType<typeof mountReferences>,
  list: HTMLElement,
  initial: ReturnType<typeof citedReferenceDocument>,
  createdId: string,
): Promise<void> {
  clickLabeled(list, 'Edit reference: A Treatise on Reference Management')
  typeText(referenceField('Reference title'), 'A Practical Guide to Reference Management')
  clickText(referenceForm(), 'Save')
  await until(() => document.body.querySelector('[data-slot="reference-editor"]') === null)
  await settleWrite(view)
  const edited = writtenLists(view.api.calls)[1]?.[1]
  expect(edited?.id).toBe(createdId)
  expect(edited?.title).toBe('A Practical Guide to Reference Management')

  clickLabeled(list, 'Remove reference: A Practical Guide to Reference Management')
  await settleWrite(view)
  expect(writtenLists(view.api.calls)).toHaveLength(3)
  expect(writtenLists(view.api.calls)[2]).toEqual(initial.document.references)
  expect(list.querySelectorAll('.reference-item')).toHaveLength(1)
  expect(one(list, '.reference-item').textContent).toContain('Attention Is All You Need')
}

it('keeps reference page edits local until the draft is discarded', async () => {
  const view = mountReferences({
    initial: referenceDocument('Reference pages'),
    width: 390,
    handlers: {},
  })
  openReferenceList(view)
  clickText(view.container, 'Add reference')
  typeText(referenceField('Reference title'), 'Parent draft stays')
  await addAuthors('Ada Lovelace\nGrace Hopper')
  const secondAuthor = texts(authorSection(), '[data-author-name]')[1]
  if (secondAuthor !== 'Grace Hopper') {
    throw new Error('The second author row was not rendered')
  }
  const secondName = Array.from(authorSection().querySelectorAll<HTMLElement>('[data-author-name]'))
    .find(name => name.textContent === 'Grace Hopper')
  if (secondName === undefined) {
    throw new Error('The Grace Hopper author row was not rendered')
  }
  act(() => click(secondName))
  await until(() => referenceEditor().querySelector('[data-author-input]') !== null)
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
  expect(referenceField('Reference title')).toHaveProperty('value', 'Parent draft stays')
  expect(texts(authorSection(), '[data-author-name]')).toEqual(['Ada Lovelace', 'Grace Hopper'])

  clickText(authorSection(), 'Add author')
  await until(() => referenceEditor().querySelector('[data-author-input]') !== null)
  clickLabeled(referenceEditor(), 'Back to reference')
  await until(() => referenceEditor().querySelector('[data-author-input]') === null)
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

  clickText(view.container, 'Add reference')
  expect(referenceField('Reference title')).toHaveProperty('value', '')
  expect(one(referenceEditor(), '[data-slot="reference-authors"] ol').children).toHaveLength(0)
})

it('validates reference fields and saves a draft without removing its cited record', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const initial = citedReferenceDocument('Reference management')
  const view = mountReferences({
    initial,
    width: 1440,
    handlers: referenceSaveRoute,
  })
  openReferenceList(view)
  const list = one(view.container, '.reference-settings')
  expect(list.querySelectorAll('input, textarea')).toHaveLength(0)
  const citedRemove = one<HTMLButtonElement>(
    list,
    'button[aria-label="Remove reference: Attention Is All You Need"]',
  )
  expect(citedRemove.disabled).toBe(true)
  expect(citedRemove.getAttribute('title'))
    .toBe('Remove citations from the body before removing this reference.')

  clickText(view.container, 'Add reference')
  expect(referenceField('DOI')).toHaveProperty('value', '')
  expect(referenceField('Reference title')).toHaveProperty('value', '')
  clickText(referenceForm(), 'Save')
  expect(texts(referenceForm(), '[role="alert"]')).toEqual([
    'Enter a title of up to 500 characters.',
    'Enter 1–50 authors, with up to 200 characters each.',
  ])
  expect(view.api.calls.filter(call => call.method !== 'GET')).toEqual([])
  typeText(referenceField('Reference title'), 'Discarded draft')
  clickText(referenceForm(), 'Cancel')
  clickText(referenceEditor(), 'Discard changes')
  await until(() => document.body.querySelector('[data-slot="reference-editor"]') === null)
  expect(view.api.calls.filter(call => call.method !== 'GET')).toEqual([])
  const createdId = await createReference(view, list)
  await cancelReferenceEdit(view, list)
  await renameAndRemoveReference(view, list, initial, createdId)
})
