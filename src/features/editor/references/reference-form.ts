import type { Document } from '@/content/document'
import type { AuthorDraft } from '@/features/editor/references/reference-authors-model'
import { useState } from 'react'
import { envelope } from '@/content/envelope'
import { normalizeDoi } from '@/content/reference-metadata'
import { authorDrafts, referenceAuthorControls } from '@/features/editor/references/reference-authors-model'
import { useDoiLookup } from '@/features/editor/references/reference-lookup'
import { useBlogTranslation } from '@/i18n/use-translation'

export type Reference = Document['references'][number]
export type ReferenceFieldName = 'title' | 'authors' | 'year' | 'url' | 'doi'
export type ReferenceDraft = Record<Exclude<ReferenceFieldName, 'authors'>, string> & { authors: AuthorDraft[] }
export type ReferenceErrors = Partial<Record<ReferenceFieldName, string>>
const errorKeys = {
  title: 'referenceTitleInvalid',
  authors: 'referenceAuthorsInvalid',
  year: 'referenceYearInvalid',
  url: 'referenceUrlInvalid',
  doi: 'referenceDoiInvalid',
} as const

export function useReferenceForm(reference: Reference, open: boolean, save: (reference: Reference) => void): {
  dirty: boolean
  authors: ReturnType<typeof referenceAuthorControls>
  draft: ReferenceDraft
  errors: ReferenceErrors
  lookup: ReturnType<typeof useDoiLookup>['lookup']
  change: (field: Exclude<ReferenceFieldName, 'authors'>, value: string) => void
  submit: (form: HTMLFormElement) => void
  retrieve: () => Promise<void>
} {
  const { t } = useBlogTranslation('editor')
  const [draft, setDraft] = useState<ReferenceDraft>(() => initialDraft(reference))
  const [errors, setErrors] = useState<ReferenceErrors>({})
  const authors = referenceAuthorControls(draft, setDraft, () => {
    setErrors(current => ({ ...current, authors: undefined }))
  })
  const retrieval = useDoiLookup(draft.doi, open, (metadata) => {
    const incoming = initialDraft({ ...metadata, id: reference.id })
    setDraft(current => fillEmptyFields(current, incoming))
    setErrors({})
  })
  const change = (field: Exclude<ReferenceFieldName, 'authors'>, value: string): void => {
    setDraft(current => ({ ...current, [field]: value }))
    setErrors(current => ({ ...current, [field]: undefined }))
    if (field === 'doi') {
      retrieval.reset()
    }
  }
  const submit = (form: HTMLFormElement): void => {
    const parsed = envelope.shape.references.element.safeParse(draftReference(reference.id, draft))
    if (parsed.success) {
      save(parsed.data)
      return
    }
    const next = referenceErrors(parsed.error.issues, key => t(key))
    setErrors(next)
    const field = Object.keys(next)[0] ?? 'title'
    const first = field === 'authors'
      ? form.querySelector('[data-author-name], [data-author-add]')
      : form.elements.namedItem(field)
    if (first instanceof HTMLElement) {
      first.focus()
    }
  }
  return {
    dirty: referenceDirty(reference, draft),
    authors,
    draft,
    errors,
    lookup: retrieval.lookup,
    change,
    submit,
    retrieve: retrieval.retrieve,
  }
}

export function initialDraft(reference: Reference): ReferenceDraft {
  return {
    title: reference.title,
    authors: authorDrafts(reference.authors),
    year: reference.year === null ? '' : String(reference.year),
    url: reference.url,
    doi: reference.doi,
  }
}
export function fillEmptyFields(current: ReferenceDraft, incoming: ReferenceDraft): ReferenceDraft {
  return {
    ...current,
    title: current.title.trim() === '' ? incoming.title : current.title,
    authors: current.authors.length === 0 ? incoming.authors : current.authors,
    year: current.year.trim() === '' ? incoming.year : current.year,
    url: current.url.trim() === '' ? incoming.url : current.url,
    doi: incoming.doi,
  }
}
function draftReference(id: string, draft: ReferenceDraft): Reference {
  return {
    id,
    title: draft.title.trim(),
    authors: draft.authors.map(author => author.name.trim()),
    year: draft.year.trim() === '' ? null : Number(draft.year),
    url: draft.url.trim(),
    doi: draft.doi.trim() === '' ? '' : normalizeDoi(draft.doi) ?? draft.doi.trim(),
  }
}
function isField(value: string): value is ReferenceFieldName {
  return value === 'title' || value === 'authors' || value === 'year' || value === 'url' || value === 'doi'
}

function referenceDirty(reference: Reference, draft: ReferenceDraft): boolean {
  return draft.title !== reference.title || draft.doi !== reference.doi || draft.url !== reference.url
    || draft.year !== (reference.year === null ? '' : String(reference.year))
    || JSON.stringify(draft.authors.map(author => author.name)) !== JSON.stringify(reference.authors)
}
function referenceErrors(
  issues: { path: PropertyKey[] }[],
  translate: (key: typeof errorKeys[ReferenceFieldName]) => string,
):
ReferenceErrors {
  const next: ReferenceErrors = {}
  for (const field of Object.keys(errorKeys)) {
    if (isField(field) && issues.some(issue => issue.path[0] === field)) {
      next[field] = translate(errorKeys[field])
    }
  }
  return next
}
