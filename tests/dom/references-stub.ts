import type { ReferenceMetadata } from '@/content/reference-metadata'
import type { OpenDocument } from '@/contracts/documents'
import { referenceMetadataSchema } from '@/content/reference-metadata'
import { editorWorkspaceDocument } from '~/tests/components/support/editor-workspace-fixtures'
import {
  citedReferenceDocument,
  citedTableDocument,
  referenceSaveRoute,
  writtenLists,
  writtenReferences,
} from '~/tests/components/support/reference-fixtures'

/*
 * Schema-built documents and transport replies for the References DOM cases.
 * These are declared data only: client parsing, citation matching, field
 * validation and save behavior stay in the production modules under test.
 */

export { citedReferenceDocument, citedTableDocument, referenceSaveRoute, writtenLists, writtenReferences }

export function referenceDocument(title = 'References DOM fixture'): OpenDocument {
  return editorWorkspaceDocument(title)
}

export const completeMetadataReply: ReferenceMetadata = referenceMetadataSchema.parse({
  doi: '10.1234/example',
  title: 'A Retrieved Research Paper',
  authors: ['Ada Lovelace', 'Grace Hopper'],
  year: 2026,
  url: 'https://doi.org/10.1234/example',
  source: 'Crossref',
})

export const partialMetadataReply: ReferenceMetadata = referenceMetadataSchema.parse({
  doi: '10.1234/partial',
  title: '',
  authors: [],
  year: null,
  url: 'https://doi.org/10.1234/partial',
  source: 'DataCite',
})
