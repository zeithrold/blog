import type { Document } from '@/content/envelope'

export function emptyDocument(): Document {
  return {
    format: 'blocknote',
    schemaVersion: 1,
    blockSchema: 'blog-blocknote-v1',
    meta: {
      title: '',
      slug: '',
      documentLocale: 'en',
      description: '',
      seo: {
        noindex: false,
      },
      tags: [],
      series: [],
    },
    blocks: [
      {
        id: crypto.randomUUID(),
        type: 'paragraph',
        props: {
          textAlignment: 'left',
          textColor: 'default',
          backgroundColor: 'default',
        },
        content: [],
        children: [],
      },
    ],
    references: [],
    citationStyle: 'ztd-numeric-v1',
    mediaAccessibility: {},
    tableAccessibility: {},
  }
}
