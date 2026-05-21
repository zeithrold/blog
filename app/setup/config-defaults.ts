export const defaultConfig = {
  notion: {
    token: '',
    datasourceId: '',
    fields: {
      tag: 'Tag',
      draft: 'Draft',
    },
  },
  site: {
    name: '@Zeithrold/Blog',
    description: 'Ahead Every Moment - @Zeithrold/Blog',
    url: '',
  },
}

/**
 * UTF-8 safe Base64 for browser clipboard export.
 */
export function toBase64(json: string) {
  return btoa(unescape(encodeURIComponent(json)))
}
