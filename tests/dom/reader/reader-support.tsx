import type { FrontendPreferences } from '@/components/ui/ztd-me'
import type { Block, Document as ReaderDocument } from '@/content/document'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createPreferencePolicy } from '@/components/ui/ztd-me'
import { emptyDocument, validateDocument } from '@/content/document'
import { DocumentReader } from '@/features/reader/document'
import { BlogFrontend } from '@/i18n/frontend'
import { installBrowserShims, setMediaState } from '~/tests/dom/shared/environment'
import { READER_CODE_SOURCE, readerFixture } from './fixtures'

const preferencePolicy = createPreferencePolicy({
  name: 'blog.dom.reader.v1',
  secure: false,
})

const preferences: FrontendPreferences = {
  version: 1,
  mode: 'light',
  palette: 'neutral',
  locale: 'en',
}

const textProps = {
  textAlignment: 'left',
  textColor: 'default',
  backgroundColor: 'default',
} as const

type ReaderView = {
  readonly container: HTMLDivElement
  readonly unmount: () => void
}

const views: ReaderView[] = []

function block(type: Block['type'], text: string, props: Block['props'] = {}): Block {
  return {
    id: crypto.randomUUID(),
    type,
    props: type === 'codeBlock' ? props : { ...textProps, ...props },
    content: [
      { type: 'text', text, styles: {} },
    ],
    children: [],
  }
}

function heading(title: string, level: number): Block {
  return block('heading', title, { level })
}

/** The real reader content fixture with read-only task states for markup assertions. */
export function readerContentFixture(): ReaderDocument {
  const document = readerFixture()
  const numberFourIndex = document.blocks.findIndex((entry) => {
    if (entry.type !== 'numberedListItem' || !Array.isArray(entry.content)) {
      return false
    }
    return entry.content.some(inline => 'text' in inline && inline.text === 'Number four')
  })
  if (numberFourIndex < 0) {
    throw new Error('The reader fixture omitted its Number four list item')
  }
  document.blocks.splice(numberFourIndex + 1, 0, block('numberedListItem', 'Number five'))
  const completed = block('checkListItem', 'Finished task', { checked: true })
  completed.children = [
    block('paragraph', 'Nested task description'),
  ]
  document.blocks.push(
    completed,
    block('checkListItem', 'Pending task', { checked: false }),
  )
  return validateDocument(document)
}

/** Adds the same source string to a highlighted code block for markup-safety coverage. */
export function readerHighlightedFixture(): ReaderDocument {
  const document = readerFixture()
  document.blocks.push(block('codeBlock', READER_CODE_SOURCE, { language: 'typescript' }))
  return validateDocument(document)
}

/** A routed-reader-shaped document whose contents link reaches a heading in nested disclosures. */
export function readerNavigationFixture(): ReaderDocument {
  const document = emptyDocument()
  document.meta.title = 'Public reader navigation'
  document.meta.slug = `reader-dom-navigation-${crypto.randomUUID()}`
  document.meta.documentLocale = 'en'
  const inner = block('toggleListItem', 'Inner details')
  inner.children = [
    heading('Inside nested details', 2),
    block('paragraph', 'Continue reading'),
  ]
  const outer = block('toggleListItem', 'Outer details')
  outer.children = [inner]
  document.blocks = [
    { id: crypto.randomUUID(), type: 'toc', props: { title: 'Reader sections' }, children: [] },
    heading('First section', 1),
    heading('', 2),
    outer,
  ]
  return validateDocument(document)
}

/** Mounts the real reader with the application's frontend and preference providers. */
export function mountReader(document: ReaderDocument, privatePreview = false): ReaderView {
  installBrowserShims()
  setMediaState({ width: 1440, reducedMotion: false, dark: false })
  const container = window.document.createElement('div')
  window.document.body.append(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      <BlogFrontend initialPreferences={preferences} policy={preferencePolicy}>
        <DocumentReader document={document} privatePreview={privatePreview} />
      </BlogFrontend>,
    )
  })
  let mounted = true
  const view: ReaderView = {
    container,
    unmount: () => {
      if (!mounted) {
        return
      }
      mounted = false
      act(() => root.unmount())
      container.remove()
    },
  }
  views.push(view)
  return view
}

/** Unmounts every reader view created by the current case. */
export function resetReaders(): void {
  for (const view of views.splice(0)) {
    view.unmount()
  }
  setMediaState({ width: 1440, reducedMotion: false, dark: false })
}
