export const documents = {
  'Writing workspace': 'workspace',
  'Documents': 'title',
  'Manage your drafts, published posts and pages.': 'description',
  'New post': 'newPost',
  'New page': 'newPage',
  'Creating…': 'creating',
  'Search by title': 'search',
  'Find a document…': 'searchPlaceholder',
  'Search': 'searchSubmit',
  'Document type': 'kind',
  'All types': 'allKinds',
  'Post': 'article',
  'Page': 'page',
  'Publication state': 'state',
  'All states': 'allStates',
  'Draft': 'draft',
  'Published': 'published',
  'Scheduled': 'scheduled',
  'Earlier revision scheduled': 'earlierScheduled',
  'Unpublished changes': 'changed',
  'Trash': 'deleted',
  'Clear filters': 'clear',
  'Refresh list': 'refresh',
  'Most recently updated first': 'order',
  'documents loaded': 'loaded',
  'Document': 'document',
  'Updated': 'updated',
  'Untitled': 'untitled',
  'Your next story starts here': 'emptyTitle',
  'Create a post or page to start writing.': 'emptyDescription',
  'No matching documents': 'noMatches',
  'Try another title or clear the filters to see all documents.': 'noMatchesDescription',
  'Trash is empty': 'emptyTrash',
  'Deleted documents appear here and can be restored as drafts.': 'emptyTrashDescription',
  'Loading documents…': 'loading',
  'Loading more documents…': 'loadingMore',
  'Load more': 'more',
  'All matching documents are loaded.': 'end',
  'Try again': 'retry',
  'Restore draft': 'restore',
  'Restoring…': 'restoring',
  [
  'Document restored as a draft. Open it from the document list to continue '
  + 'writing.'
  ]:
    'restored',
  [
  'Restoring keeps revision history. The document stays unpublished and '
  + 'cancelled schedules stay cancelled.'
  ]:
    'trashHint',
  'Unable to load documents. Check your connection and try again.': 'loadError',
  'Unable to load the next page. Your loaded documents are still available.': 'moreError',
  'Could not create the document. Try again to retry the same request.': 'createError',
  'Could not restore the document. Try again to retry the same request.': 'restoreError',
  'This document has changed. Refresh the list before trying again.': 'conflict',
  [
  'The workspace is temporarily read-only. Try again after maintenance '
  + 'finishes.'
  ]:
    'maintenance',
  'Your session could not be verified. Reload this page to sign in again.': 'authError',
  'Remove filter': 'removeFilter',
  'Active filters': 'activeFilters',
} as const
