/* eslint-disable style/max-len -- Verbatim case references stay on one line. */
/**
 * The split Media component cases and the browser-only facts they keep.
 *
 * The first-generation E2E -> component hop remains owned by
 * `tests/contracts/media-migrations.ts`: `tests/browser/media/media-gallery.spec.ts`
 * -> `tests/components/specs/media-gallery.spec.ts`,
 * `tests/browser/media/gallery-listing-boundaries.spec.ts` ->
 * `tests/components/specs/media-listing.spec.ts`,
 * `tests/browser/media/media-transfer-boundaries.spec.ts` ->
 * `tests/components/specs/media-transfer.spec.ts`,
 * `tests/browser/media/media-library-polish.spec.ts` ->
 * `tests/components/specs/media-gallery-layout.spec.ts` and
 * `tests/components/specs/media-picker.spec.ts`, and
 * `tests/browser/media/media-upload-layout.spec.ts` ->
 * `tests/components/specs/media-picker.spec.ts`. The editor-media first hop is
 * also recorded by `media-migrations.ts`: `editor-media-flow.spec.ts` and
 * `media-continuous-replacement.spec.ts` -> `editor-media.spec.ts`, and
 * `editor-video-details.spec.ts` -> `editor-media.spec.ts`. The DOM contract
 * records the component -> DOM hop; browser files stay untouched in this package.
 *
 * Fully retired component keys live in `tests/contracts/media-dom-migrations.ts`;
 * this table has one row for each component case that remains in the Playwright
 * plan because a material browser assertion survives.
 */

export type DomRetirement = {
  /** The Playwright component case as it is registered: `file :: title`. */
  readonly playwright: string
  /** jsdom cases that prove part of the component case. */
  readonly dom: readonly string[]
  /** Original assertions the jsdom cases prove. */
  readonly proves: readonly string[]
  /** Assertions of the same component case that survive only in a browser. */
  readonly remainsBrowser: readonly string[]
}

const gallery = 'tests/components/specs/media-gallery.spec.ts'
const layout = 'tests/components/specs/media-gallery-layout.spec.ts'
const picker = 'tests/components/specs/media-picker.spec.ts'
const editorMedia = 'tests/components/specs/editor-media.spec.ts'
const galleryDom = 'tests/dom/media-gallery.test.tsx'
const layoutDom = 'tests/dom/media-gallery-layout.test.tsx'
const pickerDom = 'tests/dom/media-picker.test.tsx'
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

const pickerUploads = [
  320,
  682,
  1440,
] as const
const editorMediaWidths = [390, 1440] as const

const splitCases: readonly DomRetirement[] = [
  {
    playwright: at(gallery, 'gallery accepts multi-file drops, protects active uploads and filters media'),
    dom: [
      at(galleryDom, 'gallery accepts multi-file uploads, protects active uploads and filters media'),
    ],
    proves: [
      'two input-selected files enter the real queue and transfer sequentially',
      'the active upload disables Close and prevents Escape from dismissing the dialog',
      'completed uploads appear in the gallery and search and media-type filters select the expected cards',
    ],
    remainsBrowser: [
      'the drop is a real DragEvent carrying two File entries in DataTransfer, which jsdom does not implement',
    ],
  },
  {
    playwright: at(picker, 'media cards preserve previews, keyboard selection and accessible layout at 320px'),
    dom: [
      at(pickerDom, 'media cards expose their selection and preview in zh-CN at 320px'),
    ],
    proves: [
      'the real MediaLibrary reads schema-checked listed descriptors and renders the private preview path, link attributes and file summary',
      'activating Use media passes the selected descriptor to the real MediaSources callback and closes the overlay',
    ],
    remainsBrowser: [
      'the image is painted with computed object-fit, the dialog and cards fit the compact viewport, and Axe scans computed styles',
      'Playwright focuses the Use media button and sends Enter through native keyboard activation',
      'Enter activates Use media inside the live BlockNote editor, inserts an image block and writes its public asset path in the revision packet',
    ],
  },
  {
    playwright: at(picker, 'media cards preserve previews, keyboard selection and accessible layout at 390px'),
    dom: [
      at(pickerDom, 'media cards expose their selection and preview in zh-CN at 390px'),
    ],
    proves: [
      'the real MediaLibrary reads schema-checked listed descriptors and renders the private preview path, link attributes and file summary',
      'activating Use media passes the selected descriptor to the real MediaSources callback and closes the overlay',
    ],
    remainsBrowser: [
      'the image is painted with computed object-fit, the dialog and cards fit the compact viewport, and Axe scans computed styles',
      'Playwright focuses the Use media button and sends Enter through native keyboard activation',
      'Enter activates Use media inside the live BlockNote editor, inserts an image block and writes its public asset path in the revision packet',
    ],
  },
  {
    playwright: at(picker, 'media cards preserve previews, keyboard selection and accessible layout at 1440px'),
    dom: [
      at(pickerDom, 'media cards expose their selection and preview in en at 1440px'),
    ],
    proves: [
      'the real MediaLibrary reads schema-checked listed descriptors and renders the private preview path, link attributes and file summary',
      'activating Use media passes the selected descriptor to the real MediaSources callback and closes the overlay',
    ],
    remainsBrowser: [
      'the image is painted with computed object-fit, the dialog and cards fit the desktop viewport, and Axe scans computed styles',
      'Playwright focuses the Use media button and sends Enter through native keyboard activation',
      'Enter activates Use media inside the live BlockNote editor, inserts an image block and writes its public asset path in the revision packet',
    ],
  },
  ...pickerUploads.map((width): DomRetirement => ({
    playwright: at(picker, `upload picker stays compact and supports pointer and keyboard at ${width}px`),
    dom: [
      at(pickerDom, `upload picker accepts file changes and completes both transfers at ${width}px`),
    ],
    proves: [
      'real File objects sent through input/change events aggregate as queued files in the MediaUploadForm',
      'the real queue and upload client complete both declared transfers through the schema-checked allocation and descriptor responses',
      'the width-selected editor dialog or drawer branch renders the corresponding form',
    ],
    remainsBrowser: [
      'the hidden file input, 44px picker target, label fit and horizontal bounds are measured in the browser layout engine',
      'pointer activation and Space open the actual native file chooser, which jsdom cannot deliver',
    ],
  })),
  ...layoutScenarios.map(({ width, locale, rendered }): DomRetirement => ({
    playwright: at(layout, `gallery cards keep their preview, link and layout in ${locale} at ${width}px`),
    dom: [
      at(layoutDom, `gallery cards expose their preview, link and summary in ${rendered} at ${width}px`),
    ],
    proves: [
      'the gallery name, private image content path, open-link href and target, and filename description source are rendered',
      'the listed file role and byte summary are rendered from the server descriptor',
    ],
    remainsBrowser: [
      'the thumbnail uses computed object-fit, the page has no measured horizontal overflow, and the image is painted',
      'the open link receives native keyboard focus and its accessible description is resolved by the browser',
      'Axe runs against computed styles and the real accessibility tree at this locale and viewport',
    ],
  })),
  {
    playwright: at(gallery, 'upload dialog and mobile drawer keep queued files, focus and keyboard access'),
    dom: [
      at(galleryDom, 'upload dialog and mobile drawer keep queued files and choose the compact branch'),
    ],
    proves: [
      'a queued file remains in the real session after the dialog closes and reopens as the compact drawer',
      'the same queued file completes through the real upload queue and declared HTTP responses',
    ],
    remainsBrowser: [
      'Axe scans both the desktop dialog and mobile drawer against computed styles and the browser accessibility tree',
      'the long queue produces measured drawer scrolling, the close target is in-viewport and hit-tested, and the page has no horizontal overflow',
      'closing the dialog or drawer returns native focus to the upload trigger',
    ],
  },
  ...editorMediaWidths.map((width): DomRetirement => ({
    playwright: at(editorMedia, `media replacement preserves the block and descriptions at ${width}px`),
    dom: [
      at(editorMediaFieldsDom, `image media fields expose only image descriptions at ${width}px`),
    ],
    proves: [
      'the image details fields include Alternative text but not Transcript or Video captions',
      'typing an alternative description updates the real controlled MediaFields component',
    ],
    remainsBrowser: [
      'the real BlockNote editor keeps the image block id while an upload replaces the URL and the saved revision retains its description',
      'the editor details panel and workspace state are exercised with Axe against real computed styles',
      'the live Content settings panel exposes no Media tab for this image workspace',
    ],
  })),
  ...editorMediaWidths.map((width): DomRetirement => ({
    playwright: at(editorMedia, `slash image opens media sources and fills its original placeholder at ${width}px`),
    dom: [
      at(editorMediaDialogDom, `editor media dialog uploads and selects a listed asset at ${width}px`),
    ],
    proves: [
      'the real editor media overlay exposes the upload and library sources',
      'the queue completes a declared upload and selecting a listed asset reaches the MediaSources callback and closes the overlay',
    ],
    remainsBrowser: [
      'the BlockNote slash menu receives native keyboard input and opens the media overlay',
      'the upload fills the original empty paragraph id rather than appending a second block',
    ],
  })),
  {
    playwright: at(editorMedia, 'consecutive upload replacements keep the same media block within one editing window'),
    dom: [
      at(editorMediaDialogDom, 'editor media dialog uploads and selects a listed asset at 1440px'),
    ],
    proves: [
      'the real editor media upload form completes its declared queue through the Client and schema-checked response',
      'the real MediaLibrary choice passes the listed descriptor to its selection callback',
    ],
    remainsBrowser: [
      'consecutive operations through one live BlockNote editing window preserve the same block id, description and final uploaded name in the revision packet',
    ],
  },
  {
    playwright: at(editorMedia, 'consecutive library replacements keep the same media block within one editing window'),
    dom: [
      at(editorMediaDialogDom, 'editor media dialog uploads and selects a listed asset at 1440px'),
    ],
    proves: [
      'the real editor media upload form completes its declared queue through the Client and schema-checked response',
      'the real MediaLibrary choice passes the listed descriptor to its selection callback',
    ],
    remainsBrowser: [
      'consecutive upload and library selections in one live BlockNote editing window preserve the original block id, description and final asset URL in the revision packet',
    ],
  },
  {
    playwright: at(editorMedia, 'video descriptions select uploaded captions and posters without inserting extra blocks'),
    dom: [
      at(editorMediaFieldsDom, 'video media fields edit the transcript and select caption and poster assets'),
    ],
    proves: [
      'the video fields edit Transcript and select schema-listed caption and poster assets',
      'the upload-caption and upload-poster actions request their respective media roles',
    ],
    remainsBrowser: [
      'the live BlockNote workspace stores transcript/caption/poster data on the single video block',
      'the real video element loads the served MP4 bytes and reaches native metadata-ready state without a media error',
    ],
  },
]

export const domRetirements: readonly DomRetirement[] = splitCases

/** Execution boundaries for interpreting the Media DOM retirement mapping. */
export const domGatePrerequisites: readonly string[] = [
  'Use the official `test:dom` config; its host aliases do not prove Next routing, native drag/drop or native file-chooser delivery.',
  'The DOM file-input helper dispatches real input/change events with File objects; its jsdom FileList shape does not prove DataTransfer drop semantics.',
  'The media DOM migration ledger owns exact retired component keys; this split table names only Playwright cases that remain in the component plan.',
  'Viewport measurements, painted thumbnails, native focus, browser accessibility-tree computation and Axe stay in Playwright.',
  'MediaFields is exercised directly without constructing a BlockNote block; editor-dialog-to-block and revision integration remains in the native workspace cases.',
]
