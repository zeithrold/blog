import type { Stub } from './history-page-support'
import type { PageLocale } from './history-state-support'
import type { ContentSettingsWorkspace } from '@/features/editor/workspace/editor-types'
import { Tabs } from '@/components/ui/ztd-me/client'
import { nodes } from '@/features/editor/engine/native'
import { DraftPreviewProvider } from '@/features/editor/preview/live-preview'
import { ContentSettings } from '@/features/editor/workspace/settings'
import { historyCase } from '~/tests/components/support/history-fixtures'
import { serveFetch } from './history-page-support'
import { installLayoutQueries, previewHarness, recordUnexpected, savedText } from './history-preview-remaining-support'
import { renderElement } from './history-state-support'

/**
 * The real Content tab, inside the real preview provider and Tabs root.
 *
 * The tab's sections read the opened document, its model and the catalog reads,
 * so the case supplies those as schema-valid fixtures and an explicit reply table;
 * no settings or controller is substituted. Editing a field or opening the
 * reference editor is recorded and fails the case at teardown.
 */
export async function mountContentSettings(locale: PageLocale): Promise<{
  readonly stub: Stub
  readonly root: HTMLElement
}> {
  // Load the reader chunk once, so the real lazy reader resolves on the next commit.
  await import('@/features/reader/document')
  installLayoutQueries(false)
  const fixture = historyCase({ body: savedText, latestBody: savedText })
  const harness = previewHarness(fixture)
  const model = {
    ...harness.workspace.model,
    nodeItems: nodes(fixture.initial.document),
    editorLocale: locale,
  }
  const workspace: ContentSettingsWorkspace = {
    props: { initial: fixture.initial },
    model,
    busy: false,
  }
  const stub = serveFetch({
    'GET /api/admin/catalog/series': () => ({ body: { items: [] } }),
    'GET /api/admin/catalog/tag': () => ({ body: { items: [] } }),
  })
  const view = renderElement(
    <DraftPreviewProvider workspace={{ model: harness.workspace.model }}>
      <Tabs value="content">
        <ContentSettings
          workspace={workspace}
          update={() => {
            recordUnexpected('a field edit')
          }}
          livePath={null}
          referenceOpen={false}
          setReferenceOpen={() => {
            recordUnexpected('the reference editor')
          }}
        />
      </Tabs>
    </DraftPreviewProvider>,
    locale,
  )
  return { stub, root: view.container }
}
