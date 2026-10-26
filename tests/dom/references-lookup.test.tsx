import { act } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { button, field, one, press, texts, typeText } from './dom'
import { advance, until } from './environment'
import { defer, failure } from './http'
import {
  completeMetadataReply,
  partialMetadataReply,
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

function startReference(handlers: Parameters<typeof mountReferences>[0]['handlers']) {
  const view = mountReferences({
    initial: referenceDocument('DOI reference lookup'),
    width: 1440,
    handlers,
  })
  openReferenceList(view)
  clickText(view.container, 'Add reference')
  return view
}

function messageContains(role: 'alert' | 'status', expected: string): boolean {
  const message = referenceForm().querySelector(`[role="${role}"]`)
  return message !== null && message.textContent.includes(expected)
}

async function addAuthor(value: string): Promise<void> {
  clickText(authorSection(), 'Add author')
  await until(() => referenceEditor().querySelector('[data-author-input]') !== null)
  typeText(one(authorForm(), '[data-author-input]'), value)
  clickText(authorForm(), 'Save')
  await until(() => referenceEditor().querySelector('[data-author-input]') === null)
}

it('fills empty fields from the parsed lookup and keeps manually curated values', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const lookups: string[] = []
  const view = startReference({
    ...referenceSaveRoute,
    'GET /api/admin/reference-metadata': (call) => {
      lookups.push(call.query.get('doi') ?? '')
      return { body: completeMetadataReply }
    },
  })
  typeText(referenceField('DOI'), 'https://doi.org/10.1234/example')
  press(referenceField('DOI'), 'Enter')
  await act(async () => await view.api.settle())
  await until(() => messageContains('status', 'Information retrieved'))
  expect(referenceField('DOI')).toHaveProperty('value', '10.1234/example')
  expect(referenceField('Reference title')).toHaveProperty('value', 'A Retrieved Research Paper')
  expect(texts(authorSection(), '[data-author-name]')).toEqual(['Ada Lovelace', 'Grace Hopper'])
  expect(referenceField('Year')).toHaveProperty('value', '2026')
  expect(referenceField('URL')).toHaveProperty('value', 'https://doi.org/10.1234/example')
  expect(view.api.calls.filter(call => call.method !== 'GET')).toEqual([])

  typeText(referenceField('Reference title'), 'My curated title')
  clickLabeled(one(authorSection(), '[data-author-row]'), 'Remove author 1')
  clickLabeled(one(authorSection(), '[data-author-row]'), 'Remove author 1')
  await addAuthor('My author')
  typeText(referenceField('URL'), 'https://example.com/my-link')
  clickText(referenceForm(), 'Get information')
  await act(async () => await view.api.settle())
  await until(() => messageContains('status', 'Information retrieved'))
  expect(referenceField('Reference title')).toHaveProperty('value', 'My curated title')
  expect(texts(authorSection(), '[data-author-name]')).toEqual(['My author'])
  expect(referenceField('URL')).toHaveProperty('value', 'https://example.com/my-link')
  expect(lookups).toEqual(['10.1234/example', '10.1234/example'])

  clickText(referenceForm(), 'Save')
  await until(() => document.body.querySelector('[data-slot="reference-editor"]') === null)
  await advance(2000)
  await act(async () => await view.api.expectServed())
  expect(writtenLists(view.api.calls)[0]?.[0]).toMatchObject({
    title: 'My curated title',
    authors: ['My author'],
    year: 2026,
    doi: '10.1234/example',
    url: 'https://example.com/my-link',
  })
})

it('keeps manual creation available after invalid, missing and partial DOI results', async () => {
  let requests = 0
  const view = startReference({
    'GET /api/admin/reference-metadata': () => {
      requests += 1
      return requests === 1
        ? failure(404, 'DOI_NOT_FOUND')
        : { body: partialMetadataReply }
    },
  })
  typeText(referenceField('DOI'), 'invalid')
  clickText(referenceForm(), 'Get information')
  expect(referenceForm().querySelector('[role="alert"]')?.textContent).toContain('Enter a DOI')
  expect(view.api.calls).toEqual([])

  typeText(referenceField('DOI'), '10.1234/partial')
  clickText(referenceForm(), 'Get information')
  await act(async () => await view.api.settle())
  await until(() => messageContains('alert', 'No information was found'))
  clickText(referenceForm(), 'Get information')
  await act(async () => await view.api.settle())
  await until(() => messageContains('status', 'Some information is missing'))
  expect(referenceField('Reference title')).toHaveProperty('value', '')
  expect(texts(authorSection(), '[data-author-name]')).toEqual([])
  expect(field(referenceForm(), 'Year')).toHaveProperty('value', '')
  expect(referenceField('DOI')).toHaveProperty('value', '10.1234/partial')
  expect(referenceField('URL')).toHaveProperty('value', 'https://doi.org/10.1234/partial')
  typeText(referenceField('Reference title'), 'Manual title')
  await addAuthor('Manual author')
  clickText(referenceForm(), 'Cancel')
  clickText(referenceEditor(), 'Discard changes')
  await until(() => document.body.querySelector('[data-slot="reference-editor"]') === null)
  expect(view.api.calls.filter(call => call.method !== 'GET')).toEqual([])
  expect(requests).toBe(2)
})

it('ignores a delayed lookup after the DOI changes and the draft is closed', async () => {
  const started = defer()
  const held = defer()
  const view = startReference({
    'GET /api/admin/reference-metadata': async () => {
      started.open()
      await held.promise
      return { body: completeMetadataReply }
    },
  })
  try {
    typeText(referenceField('DOI'), completeMetadataReply.doi)
    clickText(referenceForm(), 'Get information')
    await started.promise
    expect(button(referenceForm(), 'Retrieving…').disabled).toBe(true)
    expect(button(referenceForm(), 'Save').disabled).toBe(true)

    typeText(referenceField('Reference title'), 'Written during lookup')
    typeText(referenceField('DOI'), '10.1234/new')
    held.open()
    await act(async () => await view.api.settle())
    expect(referenceField('Reference title')).toHaveProperty('value', 'Written during lookup')
    expect(texts(authorSection(), '[data-author-name]')).toEqual([])

    clickText(referenceForm(), 'Cancel')
    clickText(referenceEditor(), 'Discard changes')
    await until(() => document.body.querySelector('[data-slot="reference-editor"]') === null)
    clickText(view.container, 'Add reference')
    expect(referenceField('DOI')).toHaveProperty('value', '')
    expect(referenceField('Reference title')).toHaveProperty('value', '')
    expect(view.api.calls.filter(call => call.method !== 'GET')).toEqual([])
  }
  finally {
    held.open()
    await act(async () => await view.api.settle())
  }
})

it('preserves an author entered while the metadata request is pending', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const started = defer()
  const held = defer()
  const view = startReference({
    ...referenceSaveRoute,
    'GET /api/admin/reference-metadata': async () => {
      started.open()
      await held.promise
      return { body: completeMetadataReply }
    },
  })
  try {
    typeText(referenceField('DOI'), completeMetadataReply.doi)
    clickText(referenceForm(), 'Get information')
    await started.promise
    expect(button(referenceForm(), 'Save').disabled).toBe(true)
    await addAuthor('Manually typed author')
    held.open()
    await act(async () => await view.api.settle())
    await until(() => messageContains('status', 'Information retrieved'))
    expect(texts(authorSection(), '[data-author-name]')).toEqual(['Manually typed author'])
    expect(referenceForm().querySelectorAll('[data-author-name]')).toHaveLength(1)

    clickText(referenceForm(), 'Save')
    await until(() => document.body.querySelector('[data-slot="reference-editor"]') === null)
    await advance(2000)
    await act(async () => await view.api.expectServed())
    expect(writtenLists(view.api.calls)[0]?.[0]?.authors).toEqual(['Manually typed author'])
  }
  finally {
    held.open()
    await act(async () => await view.api.settle())
  }
})
