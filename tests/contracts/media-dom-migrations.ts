/* eslint-disable style/max-len -- Verbatim case references stay on one line. */
import type { DomMigrationRecord } from './dom-migrations'

/*
 * First-generation E2E parents remain recorded in `media-migrations.ts`:
 * `tests/browser/media/media-gallery.spec.ts` -> the gallery component cases,
 * `tests/browser/media/gallery-listing-boundaries.spec.ts` -> the listing cases,
 * `tests/browser/media/media-transfer-boundaries.spec.ts` -> the transfer cases,
 * `tests/browser/media/media-library-polish.spec.ts` -> the gallery-layout and
 * picker-card cases, and `tests/browser/media/media-upload-layout.spec.ts` ->
 * the picker-upload cases. This generation names the exact component keys it
 * retires and the jsdom cases that now succeed them; no global ledger is edited.
 * The editor-media first hop also comes from `editor-media-flow.spec.ts`,
 * `media-continuous-replacement.spec.ts` and `editor-video-details.spec.ts`.
 */

const gallerySpec = 'tests/components/specs/media-gallery.spec.ts'
const layoutSpec = 'tests/components/specs/media-gallery-layout.spec.ts'
const listingSpec = 'tests/components/specs/media-listing.spec.ts'
const pickerSpec = 'tests/components/specs/media-picker.spec.ts'
const transferSpec = 'tests/components/specs/media-transfer.spec.ts'
const editorMediaSpec = 'tests/components/specs/editor-media.spec.ts'
const galleryDom = 'tests/dom/media-gallery.test.tsx'
const layoutDom = 'tests/dom/media-gallery-layout.test.tsx'
const listingDom = 'tests/dom/media-listing.test.tsx'
const pickerDom = 'tests/dom/media-picker.test.tsx'
const transferDom = 'tests/dom/media-transfer.test.tsx'
const editorMediaDialogDom = 'tests/dom/editor-media-dialog.test.tsx'
const editorMediaFieldsDom = 'tests/dom/editor-media-fields.test.tsx'

function at(file: string, title: string): string {
  return `${file} :: ${title}`
}

const layoutScenarios = [
  {
    width: 320,
    locale: 'zh',
    rendered: 'zh-CN',
  },
  {
    width: 390,
    locale: 'zh',
    rendered: 'zh-CN',
  },
  {
    width: 1440,
    locale: 'en',
    rendered: 'en',
  },
] as const

const pickerCards = [
  {
    width: 320,
    rendered: 'zh-CN',
  },
  {
    width: 390,
    rendered: 'zh-CN',
  },
  {
    width: 1440,
    rendered: 'en',
  },
] as const

const pickerUploads = [
  320,
  682,
  1440,
] as const
const transferOutcomes = [
  'committed',
  'disconnected',
  'csrf-renewal',
] as const
const editorMediaWidths = [390, 1440] as const

export const mediaDomMigrations: readonly DomMigrationRecord[] = [
  {
    id: 'media.gallery-ui',
    legacy: [
      at(gallerySpec, 'gallery accepts multi-file drops, protects active uploads and filters media'),
      at(gallerySpec, 'upload dialog and mobile drawer keep queued files, focus and keyboard access'),
    ],
    dom: [
      {
        case: at(galleryDom, 'gallery accepts multi-file uploads, protects active uploads and filters media'),
        contracts: [],
        proves: [
          'two input-selected files enter the real queue and transfer sequentially',
          'the active upload disables Close and prevents Escape from dismissing the dialog',
          'completed uploads appear in the gallery and search and media-type filters select the expected cards',
        ],
      },
      {
        case: at(galleryDom, 'upload dialog and mobile drawer keep queued files and choose the compact branch'),
        contracts: [],
        proves: [
          'a queued file remains in the real session after the dialog closes and reopens as the compact drawer',
          'the same queued file completes through the real upload queue and declared HTTP responses',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(gallerySpec, 'gallery accepts multi-file drops, protects active uploads and filters media'),
        ],
        reason: 'Split, not retired: the DOM case proves queue, active-upload guard, completion and filters; this browser case keeps a real DataTransfer drag/drop delivering multiple File objects. Its title is the retained registration identity, so the wider wording is known naming debt and only the drop delivery is read as this case\'s evidence.',
      },
      {
        cases: [
          at(gallerySpec, 'upload dialog and mobile drawer keep queued files, focus and keyboard access'),
        ],
        reason: 'Split, not retired: jsdom proves queued-file retention and the compact branch; the browser case keeps Axe on both computed-style surfaces, measured drawer scrolling and close hit testing, viewport overflow and native focus return.',
      },
    ],
  },
  {
    id: 'media.gallery-layout',
    legacy: layoutScenarios.map(({ width, locale }) =>
      at(layoutSpec, `gallery cards keep their preview, link and layout in ${locale} at ${width}px`)),
    dom: layoutScenarios.map(({ width, rendered }) => ({
      case: at(layoutDom, `gallery cards expose their preview, link and summary in ${rendered} at ${width}px`),
      contracts: [],
      proves: [
        'the gallery name, private image content path, open-link href and target, and filename description source are rendered',
        'the listed file role and byte summary are rendered from the server descriptor',
      ],
    })),
    retained: [
      {
        cases: layoutScenarios.map(({ width, locale }) =>
          at(layoutSpec, `gallery cards keep their preview, link and layout in ${locale} at ${width}px`)),
        reason: 'Split, not retired: DOM proves markup, paths and summaries. The browser cases keep computed object-fit and painted thumbnails, measured horizontal bounds, native link focus and accessible-description resolution, and Axe against computed styles.',
      },
    ],
  },
  {
    id: 'media.gallery-listing',
    legacy: [
      at(listingSpec, 'a delayed gallery refresh keeps an upload completed while it was reading'),
      at(listingSpec, 'a later authoritative gallery refresh removes a card absent from the server listing'),
    ],
    dom: [
      {
        case: at(listingDom, 'a delayed gallery refresh keeps an upload completed while it was reading'),
        contracts: [],
        proves: [
          'a completed upload survives a server listing response that was already in flight',
          'the held refresh is authoritative only for work completed before it began',
        ],
      },
      {
        case: at(listingDom, 'a later authoritative gallery refresh removes a card absent from the server listing'),
        contracts: [],
        proves: [
          'an accepted upload is visible before refresh',
          'a later authoritative listing removes the card the server no longer returns',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'media.editor-picker',
    legacy: [
      ...pickerCards.map(({ width }) =>
        at(pickerSpec, `media cards preserve previews, keyboard selection and accessible layout at ${width}px`)),
      ...pickerUploads.map(width =>
        at(pickerSpec, `upload picker stays compact and supports pointer and keyboard at ${width}px`)),
    ],
    dom: [
      ...pickerCards.map(({ width, rendered }) => ({
        case: at(pickerDom, `media cards expose their selection and preview in ${rendered} at ${width}px`),
        contracts: [],
        proves: [
          'the real MediaLibrary reads schema-checked listed descriptors and renders the private preview path, link attributes and file summary',
          'activating Use media passes the selected descriptor to the real MediaSources callback and closes the overlay',
        ],
      })),
      ...pickerUploads.map(width => ({
        case: at(pickerDom, `upload picker accepts file changes and completes both transfers at ${width}px`),
        contracts: [],
        proves: [
          'real File objects sent through input/change events aggregate as queued files in the MediaUploadForm',
          'the real queue and upload client complete both declared transfers through the schema-checked allocation and descriptor responses',
          'the width-selected editor dialog or drawer branch renders the corresponding form',
        ],
      })),
    ],
    retained: [
      {
        cases: pickerCards.map(({ width }) =>
          at(pickerSpec, `media cards preserve previews, keyboard selection and accessible layout at ${width}px`)),
        reason: 'Split, not retired: DOM proves card markup and click selection. Browser cases keep painted previews and measured dialog layout, Axe against computed styles, native focus, and Enter activation into BlockNote with its revision packet.',
      },
      {
        cases: pickerUploads.map(width =>
          at(pickerSpec, `upload picker stays compact and supports pointer and keyboard at ${width}px`)),
        reason: 'Split, not retired: DOM proves file-input queue and transfer state. Browser cases keep hidden-input/target geometry and the real native file chooser opened by pointer and Space.',
      },
    ],
  },
  {
    id: 'media.transfer-retry-wire',
    legacy: transferOutcomes.map(outcome =>
      at(transferSpec, `media retry reuses its upload allocation after a ${outcome} transfer`)),
    dom: transferOutcomes.map(outcome => ({
      case: at(transferDom, `media retry reuses its upload allocation after a ${outcome} transfer`),
      contracts: [],
      proves: [
        'retry completes through the real gallery session, queue, client and schema-checked responses',
        'one UUID-keyed allocation has the exact payload hash and every retry uses the same content path',
        'descriptor reads and transfer attempts match the committed, disconnected or CSRF-renewal outcome',
      ],
    })),
    retained: [],
  },
  {
    id: 'media.editor-media',
    legacy: [
      ...editorMediaWidths.flatMap(width => [
        at(editorMediaSpec, `media replacement preserves the block and descriptions at ${width}px`),
        at(editorMediaSpec, `slash image opens media sources and fills its original placeholder at ${width}px`),
      ]),
      at(editorMediaSpec, 'consecutive upload replacements keep the same media block within one editing window'),
      at(editorMediaSpec, 'consecutive library replacements keep the same media block within one editing window'),
      at(editorMediaSpec, 'video descriptions select uploaded captions and posters without inserting extra blocks'),
    ],
    dom: [
      ...editorMediaWidths.map(width => ({
        case: at(editorMediaFieldsDom, `image media fields expose only image descriptions at ${width}px`),
        contracts: [],
        proves: [
          'the image details fields include Alternative text but not Transcript or Video captions',
          'typing an alternative description updates the real controlled MediaFields component',
        ],
      })),
      ...editorMediaWidths.map(width => ({
        case: at(editorMediaDialogDom, `editor media dialog uploads and selects a listed asset at ${width}px`),
        contracts: [],
        proves: [
          'the real editor media overlay exposes upload and library sources',
          'the queue completes a declared upload and the listed-asset choice reaches MediaSources and closes the overlay',
        ],
      })),
      {
        case: at(editorMediaFieldsDom, 'video media fields edit the transcript and select caption and poster assets'),
        contracts: [],
        proves: [
          'the video fields edit Transcript and select schema-listed caption and poster assets',
          'the upload-caption and upload-poster actions request their respective media roles',
        ],
      },
    ],
    retained: [
      {
        cases: editorMediaWidths.map(width =>
          at(editorMediaSpec, `media replacement preserves the block and descriptions at ${width}px`)),
        reason: 'Split, not retired: DOM proves image detail-field shape and controlled edits. Browser cases keep live BlockNote replacement/reuse, block id and saved description/URL, Axe and Content settings state; the page-free support does not construct a fake editor workspace.',
      },
      {
        cases: editorMediaWidths.map(width =>
          at(editorMediaSpec, `slash image opens media sources and fills its original placeholder at ${width}px`)),
        reason: 'Split, not retired: DOM proves media dialog upload/library state. Browser cases keep native slash-menu keyboard interaction and live BlockNote placeholder-to-image replacement with the original block id.',
      },
      {
        cases: [
          at(editorMediaSpec, 'consecutive upload replacements keep the same media block within one editing window'),
          at(editorMediaSpec, 'consecutive library replacements keep the same media block within one editing window'),
        ],
        reason: 'Split, not retired: DOM proves shared upload queue and library selection behavior. Browser cases keep consecutive changes to one live BlockNote block and verify its identity, description and final revision packet.',
      },
      {
        cases: [
          at(editorMediaSpec, 'video descriptions select uploaded captions and posters without inserting extra blocks'),
        ],
        reason: 'Split, not retired: DOM proves transcript, caption/poster selection and upload-role callbacks. The browser case keeps those fields integrated with one live video block and proves native decoding of the served MP4 bytes.',
      },
    ],
  },
]
