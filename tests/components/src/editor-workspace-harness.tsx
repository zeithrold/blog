'use client'
import type { ReactNode } from 'react'
import { lazy, Suspense } from 'react'
import { SiteShell } from '@/components/site-shell'
import { LoadingEditor } from '@/features/editor/workspace/editor-loading'
import { editorWorkspaceDocument } from '../support/editor-workspace-fixtures'
import { COMPONENT_TEST_FIXTURES } from './fixtures'

// The app loads the editor as its own chunk, and no other component surface
// needs it. Loading it the same way here keeps the block editor out of every
// lightweight case's page load.
const ProductionEditorEntry = lazy(async () => ({
  default: (await import('@/features/editor/workspace/editor-entry')).default,
}))

/**
 * Editor workspace surface: the production editor entry, inside the production
 * shell and navigation guard.
 *
 * The seed only names the document to open; the entry performs its real session
 * and document load, and a case decides what those HTTP replies contain. Every
 * block view, controller and provider below is the production one, so what the
 * case asserts is what an author gets.
 */
export function EditorWorkspaceSurface(): ReactNode {
  return (
    <SiteShell>
      <Suspense fallback={<LoadingEditor />}>
        <ProductionEditorEntry
          initial={editorWorkspaceDocument()}
          owner={COMPONENT_TEST_FIXTURES.owner}
          csrfToken={COMPONENT_TEST_FIXTURES.csrfToken}
        />
      </Suspense>
    </SiteShell>
  )
}
