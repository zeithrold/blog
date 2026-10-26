import type { Locator, Page } from '@playwright/test'
import type { ComponentLocale, ComponentMode } from '../src/contract'
import type { ApiHandler, ApiService } from './http-fixtures'
import type { Inline, Styles } from '@/content/inline'
import type { OpenDocument } from '@/contracts/documents'
import { expect } from '@playwright/test'
import { z } from 'zod'
import { inline } from '@/content/inline'
import {
  formattingCopy,
  lastPacketContent,
  linkPrefix,
  linkSelected,
  linkSuffix,
} from './editor-formatting-fixtures'
import {
  editorWorkspaceDocument,
  editorWorkspaceSaveAck,
  paragraphBlock,
} from './editor-workspace-fixtures'
import { editorReady, mountEditorWorkspace } from './editor-workspace-ui'

/**
 * The documents, phrases and packet readers the remaining link slice asserts on.
 *
 * A case mounts the production editor entry over HTTP, so the document it opens is its own and
 * the replies a save receives are acknowledged here. Nothing replaces a controller, a model or
 * the editor: content a case asserts is parsed with the schema the client itself parses.
 */
export const linkText = `${linkPrefix}${linkSelected}${linkSuffix}`

// The phrase, range and destination of the shared formatting fixtures, re-exported so a case
// imports its link vocabulary from one place.
export { linkPrefix, linkSelected, linkSuffix, linkUrl } from './editor-formatting-fixtures'

export const linkSelection = {
  start: linkPrefix.length,
  end: linkPrefix.length + linkSelected.length,
} as const
export const oldLink = 'https://example.com/old'
export const nextLink = 'https://example.com/next'
export const replacementLink = '/posts/replacement#part'
export const adjacentText = 'AlphaBetaPlain'

export type LinkWorkspace = {
  readonly api: ApiService
  readonly body: Locator
}

/** Mounts the workspace on a one-paragraph link fixture and waits for its loaded body. */
export async function openLinkWorkspace(page: Page, options: {
  text?: string
  document?: OpenDocument
  locale?: ComponentLocale
  width?: number
  mode?: ComponentMode
  writes?: Readonly<Record<string, ApiHandler>>
} = {}): Promise<LinkWorkspace> {
  const locale = options.locale ?? 'en'
  const open = options.document ?? editorWorkspaceDocument('Link interaction', (document) => {
    document.blocks = [
      paragraphBlock(options.text ?? linkText),
    ]
  })
  const api = await mountEditorWorkspace(page, {
    document: open,
    width: options.width ?? 1440,
    locale,
    mode: options.mode,
    writes: {
      'PUT /api/admin/documents/:id/revisions': editorWorkspaceSaveAck,
      ...options.writes,
    },
  })
  await editorReady(page, locale)
  return { api, body: page.getByLabel(formattingCopy[locale].body, { exact: true }) }
}

/** The two adjacent links and the plain text the selection cases run over. */
export function adjacentLinkContent(): Inline[] {
  return [
    { type: 'link', href: oldLink, content: [
      { type: 'text', text: 'Alpha', styles: { bold: true } },
    ] },
    { type: 'link', href: nextLink, content: [
      { type: 'text', text: 'Beta', styles: {} },
    ] },
    { type: 'text', text: 'Plain', styles: { italic: true } },
  ]
}

export function adjacentLinks(): OpenDocument {
  return editorWorkspaceDocument('Adjacent links', (document) => {
    document.blocks = [
      { ...paragraphBlock(''), content: adjacentLinkContent() },
    ]
  })
}

/** The adjacent paragraph after `Beta` is renamed `Updated` and points at the anchor. */
export function editedLinkContent(href = '#anchor'): Inline[] {
  return [
    { type: 'link', href: oldLink, content: [
      { type: 'text', text: 'Alpha', styles: { bold: true } },
    ] },
    { type: 'link', href, content: [
      { type: 'text', text: 'Updated', styles: {} },
    ] },
    { type: 'text', text: 'Plain', styles: { italic: true } },
  ]
}

/** The same paragraph after the edited link is removed: its text stays plain. */
export function unlinkedEditedContent(): Inline[] {
  return [
    { type: 'link', href: oldLink, content: [
      { type: 'text', text: 'Alpha', styles: { bold: true } },
    ] },
    { type: 'text', text: 'Updated', styles: {} },
    { type: 'text', text: 'Plain', styles: { italic: true } },
  ]
}

/** URL-shaped text that was stored as plain text, so loading it must not autolink. */
export function urlShapedDocument(): OpenDocument {
  return editorWorkspaceDocument('URL shaped text', (document) => {
    document.blocks = [
      {
        ...paragraphBlock(''),
        content: [
          { type: 'text', text: 'https://example.com ', styles: {} },
        ],
      },
    ]
  })
}

export type Character = { character: string, href: string, styles: Styles }

function textCharacters(text: string, href: string, styles: Styles): Character[] {
  return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), entry => ({
    character: entry.segment,
    href,
    styles,
  }))
}

/** One entry per grapheme, so an assertion holds however the client splits text nodes. */
export function charactersOf(content: readonly Inline[]): Character[] {
  return content.flatMap((item) => {
    if (item.type === 'link') {
      return item.content.flatMap(text => textCharacters(text.text, item.href, text.styles))
    }
    return item.type === 'text' ? textCharacters(item.text, '', item.styles) : []
  })
}

const inlineList = z.array(inline)

/** The characters the client last sent, or undefined while no packet has arrived. */
export function packetCharacters(api: ApiService): Character[] | undefined {
  const parsed = inlineList.safeParse(lastPacketContent(api))
  return parsed.success ? charactersOf(parsed.data) : undefined
}

export function charactersWithLink(
  original: readonly Character[],
  selection: { readonly from: number, readonly to: number },
  href: string,
): Character[] {
  return original.map((character, index) => ({
    ...character,
    href: index >= selection.from && index < selection.to ? href : character.href,
  }))
}

export async function expectPacketCharacters(api: ApiService, expected: readonly Character[]): Promise<void> {
  await expect.poll(() => packetCharacters(api), { timeout: 15000 }).toEqual(expected)
}

/** Polls until a save lands whose content carries no link, so an undo is observed stored. */
export async function expectPacketUnlinked(api: ApiService): Promise<void> {
  await expect.poll(() => packetCharacters(api)?.some(character => character.href !== ''), { timeout: 15000 })
    .toBe(false)
}

/** The paragraph content after a link is applied to the phrase the fixtures select. */
export function linkedContent(href: string): unknown[] {
  return [
    { type: 'text', text: linkPrefix, styles: {} },
    { type: 'link', href, content: [
      { type: 'text', text: linkSelected, styles: {} },
    ] },
    { type: 'text', text: linkSuffix, styles: {} },
  ]
}
