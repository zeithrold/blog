'use client'
import type { ReactNode } from 'react'
import { SiteShell } from '@/components/site-shell'
import { DocumentList } from '@/features/documents/document-list'
import { COMPONENT_TEST_FIXTURES } from './fixtures'

/**
 * The admin shell chrome, mounted at the admin route the case navigates to.
 *
 * `SiteShell` renders the real application chrome (appbar, section navigation,
 * sidebar) and chooses the admin one from the document pathname, so the harness
 * page path is the section under test. The main slot stays deliberately empty:
 * every assertion belongs to the chrome the surface exists for.
 */
export function AdminNavigationSurface(): ReactNode {
  return <SiteShell><div className="px-4 py-6" /></SiteShell>
}

/**
 * The admin controls the chrome and the documents surface own: the compact
 * navigation and appbar menus around the real document list with its filter
 * Selects. The list response comes from the case's HTTP boundary, so an empty
 * page keeps the filter bar the only thing under test.
 */
export function AdminControlsSurface(): ReactNode {
  return (
    <SiteShell>
      <DocumentList csrfToken={COMPONENT_TEST_FIXTURES.csrfToken} />
    </SiteShell>
  )
}
