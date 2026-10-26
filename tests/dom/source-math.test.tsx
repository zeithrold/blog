import type { Document } from '@/content/document'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { createPreferencePolicy } from '@/components/ui/ztd-me'
import { DocumentReader } from '@/features/reader/document'
import { BlogFrontend } from '@/i18n/frontend'
import { EDITOR_MATH_SOURCES } from '~/tests/components/support/editor-fixtures'
import { installBrowserShims, setMediaState } from './environment'
import { inlineMathPreviewDocument, mathPreviewDocument } from './source-support'

const policy = createPreferencePolicy({
  name: 'blog.dom.source-math.v1',
  secure: false,
})

function renderReader(document: Document): {
  container: HTMLDivElement
  unmount: () => void
} {
  const container = globalThis.document.createElement('div')
  installBrowserShims()
  setMediaState({ width: 1440, reducedMotion: false, dark: false })
  globalThis.document.body.append(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      <BlogFrontend
        initialPreferences={{ version: 1, mode: 'light', palette: 'neutral', locale: 'en' }}
        policy={policy}
      >
        <DocumentReader document={document} />
      </BlogFrontend>,
    )
  })
  return {
    container,
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

it('real reader block previews render MathML for every editor fixture without changing source', () => {
  const initial = mathPreviewDocument()
  const view = renderReader(initial.document)
  try {
    const formulas = Array.from(view.container.querySelectorAll('.math-display'))
    expect(formulas).toHaveLength(EDITOR_MATH_SOURCES.length)
    for (const [index, formula] of formulas.entries()) {
      expect(formula.querySelector('math')).not.toBeNull()
      expect(initial.document.blocks[index]?.content).toEqual([
        { type: 'text', text: EDITOR_MATH_SOURCES[index], styles: {} },
      ])
    }
  }
  finally {
    view.unmount()
  }
})

it('real reader inline math previews render their source as MathML', () => {
  const initial = inlineMathPreviewDocument()
  const view = renderReader(initial.document)
  try {
    expect(view.container.querySelector('.math-inline math')).not.toBeNull()
    expect(initial.document.blocks[0]?.content).toEqual([
      { type: 'text', text: 'Inline formula ', styles: {} },
      { type: 'inlineMath', props: { source: 'a^2' } },
    ])
  }
  finally {
    view.unmount()
  }
})
