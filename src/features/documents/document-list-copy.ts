import type { DocumentsState } from '@/features/documents/document-list-model'
import type { BlogMessageKey } from '@/i18n/instance'
import { useBlogTranslation } from '@/i18n/use-translation'

export type DocumentListCopy = { [K in BlogMessageKey<'documents'>]: string }

export function useDocumentListCopy(): DocumentListCopy {
  const { t } = useBlogTranslation('documents')
  return {
    title: t('title'),
    description: t('description'),
    newPost: t('newPost'),
    newPage: t('newPage'),
    creating: t('creating'),
    search: t('search'),
    searchPlaceholder: t('searchPlaceholder'),
    searchSubmit: t('searchSubmit'),
    kind: t('kind'),
    allKinds: t('allKinds'),
    article: t('article'),
    page: t('page'),
    state: t('state'),
    allStates: t('allStates'),
    draft: t('draft'),
    published: t('published'),
    scheduled: t('scheduled'),
    earlierScheduled: t('earlierScheduled'),
    changed: t('changed'),
    deleted: t('deleted'),
    clear: t('clear'),
    removeFilter: t('removeFilter'),
    activeFilters: t('activeFilters'),
    refresh: t('refresh'),
    order: t('order'),
    loaded: t('loaded'),
    document: t('document'),
    updated: t('updated'),
    untitled: t('untitled'),
    emptyTitle: t('emptyTitle'),
    emptyDescription: t('emptyDescription'),
    noMatches: t('noMatches'),
    noMatchesDescription: t('noMatchesDescription'),
    emptyTrash: t('emptyTrash'),
    emptyTrashDescription: t('emptyTrashDescription'),
    loading: t('loading'),
    loadingMore: t('loadingMore'),
    more: t('more'),
    end: t('end'),
    retry: t('retry'),
    restore: t('restore'),
    restoring: t('restoring'),
    restored: t('restored'),
    trashHint: t('trashHint'),
    loadError: t('loadError'),
    moreError: t('moreError'),
    createError: t('createError'),
    restoreError: t('restoreError'),
    createUnknown: t('createUnknown'),
    restoreUnknown: t('restoreUnknown'),
    conflict: t('conflict'),
    maintenance: t('maintenance'),
    authError: t('authError'),
  }
}

export function documentListError(state: DocumentsState, copy: DocumentListCopy): string {
  const known: Record<string, string> = {
    EDIT_CONFLICT: copy.conflict,
    MAINTENANCE: copy.maintenance,
    MUTATION_OUTCOME_UNKNOWN: state.error === 'restore' ? copy.restoreUnknown : copy.createUnknown,
  }
  const message = known[state.errorCode]
  if (message !== undefined) {
    return message
  }
  if (state.errorCode.includes('AUTH') || state.errorCode.includes('ACCESS') || state.errorCode === 'OWNER_REQUIRED') {
    return copy.authError
  }
  if (state.error === 'article' || state.error === 'page') {
    return copy.createError
  }
  if (state.error === 'restore') {
    return copy.restoreError
  }
  return state.error === 'more' ? copy.moreError : copy.loadError
}
