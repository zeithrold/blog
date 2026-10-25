/* eslint-disable style/max-len -- Verbatim case references stay on one line. */
import type { CaseMigration } from './types'

const transferOutcomes = [
  'committed',
  'disconnected',
  'csrf-renewal',
] as const
const galleryWidths = [
  320,
  390,
  1440,
] as const
const uploadWidths = [
  320,
  682,
  1440,
] as const

export const mediaMigrations: readonly CaseMigration[] = [
  {
    id: 'media.gallery-ui',
    legacy: [
      'tests/browser/media/media-gallery.spec.ts :: gallery accepts multi-file drops, protects active uploads and filters media',
      'tests/browser/media/media-gallery.spec.ts :: upload dialogs and mobile drawers keep queued files, focus and keyboard access',
    ],
    component: [
      {
        case: 'tests/components/specs/media-gallery.spec.ts :: gallery accepts multi-file drops, protects active uploads and filters media',
        proves: [
          'multi-file drop queues both files and blocks closing while the first transfer is held',
          'sequential transfers show completed cards, private image previews and search/type filtering',
        ],
      },
      {
        case: 'tests/components/specs/media-gallery.spec.ts :: upload dialog and mobile drawer keep queued files, focus and keyboard access',
        describe: ['accessibility scanner'],
        proves: [
          'desktop dialog and 320px drawer pass Axe with reachable close controls and no page overflow',
          'closing preserves queued files, reopening can upload them, and closing restores trigger focus',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'media.gallery-listing',
    legacy: [
      'a delayed gallery refresh keeps an upload completed while it was reading',
      'a later authoritative gallery refresh removes a card absent from the server listing',
    ].map(title => `tests/browser/media/gallery-listing-boundaries.spec.ts :: ${title}`),
    component: [
      'a delayed gallery refresh keeps an upload completed while it was reading',
      'a later authoritative gallery refresh removes a card absent from the server listing',
    ].map(title => ({
      case: `tests/components/specs/media-listing.spec.ts :: ${title}`,
      proves: ['the real gallery reconciles held and authoritative listing reads with acknowledged uploads'],
    })),
    retained: [],
  },
  {
    id: 'media.transfer-retry-wire',
    legacy: transferOutcomes.map(outcome =>
      `tests/browser/media/media-transfer-boundaries.spec.ts :: media retry reuses its upload allocation after a ${outcome} transfer`),
    component: transferOutcomes.map(outcome => ({
      case: `tests/components/specs/media-transfer.spec.ts :: media retry reuses its upload allocation after a ${outcome} transfer`,
      proves: [
        'retry reaches a completed row through the real client, queue and session',
        'one UUID-keyed allocation has the exact payload hash and every retry names the same content path',
        'descriptor reads and transfer attempts match the declared committed, disconnected or CSRF-renewal outcome',
      ],
    })),
    retained: [],
  },
  {
    id: 'media.editor-picker',
    legacy: [
      ...galleryWidths.map(width =>
        `tests/browser/media/media-library-polish.spec.ts :: media cards preserve previews, keyboard selection and accessible layout at ${width}px`),
      ...uploadWidths.map(width =>
        `tests/browser/media/media-upload-layout.spec.ts :: upload picker stays compact and supports pointer and keyboard at ${width}px`),
    ],
    component: [
      ...galleryWidths.map(width => ({
        case: `tests/components/specs/media-picker.spec.ts :: media cards preserve previews, keyboard selection and accessible layout at ${width}px`,
        proves: [
          'the real editor picker preserves previews, keyboard insertion, accessible layout and the revision packet',
        ],
      })),
      ...uploadWidths.map(width => ({
        case: `tests/components/specs/media-picker.spec.ts :: upload picker stays compact and supports pointer and keyboard at ${width}px`,
        proves: ['pointer and keyboard file selection preserve the compact control geometry and upload both files'],
      })),
      ...galleryWidths.map(width => ({
        case: `tests/components/specs/media-gallery-layout.spec.ts :: gallery cards keep their preview, link and layout in ${width === 1440 ? 'en' : 'zh'} at ${width}px`,
        proves: [
          'the gallery tail keeps its filename, byte summary, layout and Axe checks on the real gallery surface',
        ],
      })),
    ],
    retained: [],
  },
]
