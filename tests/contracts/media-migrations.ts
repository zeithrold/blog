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
const mediaFlowWidths = [390, 1440] as const
const replacementSources = ['upload', 'library'] as const

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
        proves: ['a real DataTransfer drop delivers both files, and the dialog lists each one by name'],
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
  // The editor's own save request carries these payloads; R2, private routing,
  // Range/CSP and reload persistence stay with media.spec.ts and the services
  // integration cases.
  {
    id: 'media.editor-media',
    legacy: [
      ...mediaFlowWidths.map(width =>
        `tests/browser/media/editor-media-flow.spec.ts :: media replacement preserves the block and descriptions at ${width}px`),
      ...mediaFlowWidths.map(width =>
        `tests/browser/media/editor-media-flow.spec.ts :: slash image opens media sources and fills its original placeholder at ${width}px`),
      ...replacementSources.map(source =>
        `tests/browser/media/media-continuous-replacement.spec.ts :: consecutive ${source} replacements keep the same media block within one editing window`),
      'tests/browser/media/editor-video-details.spec.ts :: video descriptions select uploaded captions and posters without inserting extra blocks',
    ],
    component: [
      ...mediaFlowWidths.map(width => ({
        case: `tests/components/specs/editor-media.spec.ts :: media replacement preserves the block and descriptions at ${width}px`,
        proves: [
          'the saved revision keeps every block id, one image and the alternative text; the replacement changes the URL and choosing the original restores it',
          'an image has no transcript or caption controls and Content settings has no Media tab',
        ],
      })),
      ...mediaFlowWidths.map(width => ({
        case: `tests/components/specs/editor-media.spec.ts :: slash image opens media sources and fills its original placeholder at ${width}px`,
        proves: [
          'Escape closes the picker and the add-file control reopens it, and the upload fills the placeholder paragraph id under /assets/',
        ],
      })),
      ...replacementSources.map(source => ({
        case: `tests/components/specs/editor-media.spec.ts :: consecutive ${source} replacements keep the same media block within one editing window`,
        proves: [
          'one window of consecutive replacements keeps every block id and one image, ends on the final name and keeps the original URL only when the library reused it',
        ],
      })),
      {
        case: 'tests/components/specs/editor-media.spec.ts :: video descriptions select uploaded captions and posters without inserting extra blocks',
        proves: [
          'captions and poster travel the real upload boundary, the save packet keeps one media block, the transcript, and the caption/poster allocation ids the ledger recorded',
        ],
      },
    ],
    retained: [
      {
        cases: mediaFlowWidths.map(width =>
          `tests/browser/media/editor-media-flow.spec.ts :: media replacement preserves the block and descriptions at ${width}px`),
        reason: 'only the built app proves a saved replacement still reloads with its alternative text',
      },
    ],
  },
]
