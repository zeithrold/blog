/* eslint-disable style/max-len -- One row per registered component case, with exact lineage and successors. */
/* eslint-disable max-lines -- One data record per registered component case. */
/**
 * Where each admin component case now runs.
 *
 * `lineage` lists the earlier E2E case when it exists; the row's `playwright`
 * key is the current component generation, and `dom` names the jsdom successor.
 * Native assertions that remain in the component plan are listed individually.
 */

export type AdminDomRetirement = {
  readonly playwright: string
  readonly lineage: readonly string[]
  readonly dom: readonly string[]
  readonly proves: readonly string[]
  readonly remainsBrowser: readonly string[]
}

const controls = 'tests/components/specs/admin-controls.spec.ts'
const navigation = 'tests/components/specs/admin-navigation.spec.ts'
const services = 'tests/components/specs/admin-editor-services.spec.ts'
const state = 'tests/components/specs/admin-editor-state.spec.ts'
const ui = 'tests/components/specs/admin-editor-ui.spec.ts'
const e2eMenu = 'tests/browser/admin/admin-navigation-motion.spec.ts'
const e2eSelect = 'tests/browser/admin/select-polish.spec.ts'
const e2eAction = 'tests/browser/admin/action-polish.spec.ts'
const e2eDialog = 'tests/browser/admin/dialog-motion.spec.ts'
const e2eInspector = 'tests/browser/admin/inspector-group-polish.spec.ts'
const e2ePolish = 'tests/browser/admin/admin-polish.spec.ts'
const e2eAppearance = 'tests/browser/admin/appearance.spec.ts'
const e2eServices = 'tests/browser/admin/services.spec.ts'
const adminControlsDom = 'tests/dom/admin-controls.test.tsx'
const adminNavigationDom = 'tests/dom/admin-navigation.test.tsx'
const adminServicesDom = 'tests/dom/admin-editor-services.test.tsx'
const adminStateDom = 'tests/dom/admin-editor-state.test.tsx'
const adminUiDom = 'tests/dom/admin-editor-ui.test.tsx'
const widths = [390, 800] as const

function at(file: string, title: string): string {
  return `${file} :: ${title}`
}

export const adminDomRetirements: readonly AdminDomRetirement[] = [
  {
    playwright: at(controls, 'admin Selects keep one text gutter, a centered right check and animate in and out'),
    lineage: [
      at(e2eSelect, 'Select options retain one text gutter, show a centered right check and animate in and out'),
    ],
    dom: [
      at(adminControlsDom, 'the document type filter opens its real choices and sends the chosen type'),
    ],
    proves: [
      'the document type filter exposes All types, Post and Page',
      'choosing Post sends kind=article through the real document-list client',
    ],
    remainsBrowser: [
      'each option text gutter is measured at 11-13px, its text is static and its outline is none',
      'the checked option indicator is 11-13px from the right edge and centered within 1px',
      'the filter popper reports its bottom side and the native ztd-menu-enter animation',
      'ArrowDown delivers focus to Post and Escape delivers focus back to the filter trigger',
      'the language menu keeps the same measured option geometry and native enter animation',
      'the appearance radio checks keep a measured 12px right inset',
      'the filter exit reports the native ztd-menu-exit animation and unmounts the popper',
    ],
  },
  {
    playwright: at(controls, 'compact admin Selects keep options aligned and respect reduced motion at 320px'),
    lineage: [
      at(e2eSelect, 'compact Select keeps options aligned and respects reduced motion'),
    ],
    dom: [
      at(adminControlsDom, 'the compact admin controls use Chinese choices and respect the declared mobile host'),
    ],
    proves: [
      'the host reports a 320px viewport and reduced-motion preference without selecting a product branch',
      'switching language renders the Chinese document type choices 所有类型, 文章 and 页面',
    ],
    remainsBrowser: [
      'the Chinese option text and check positions are measured in the real 320px layout',
      'reduced motion removes the native menu animations and the page stays within its painted viewport',
      'Escape delivers focus to the type trigger and the language menu keeps its measured geometry',
    ],
  },
  ...widths.map(width => ({
    playwright: at(navigation, `compact admin menu animates opening and closing at ${width}px`),
    lineage: [
      at(e2eMenu, `admin section menu animates opening and closing at ${width}px`),
    ],
    dom: [
      at(adminNavigationDom, `the compact admin menu lists the current section and every destination at ${width}px`),
    ],
    proves: [
      'the Operations trigger reports its current section and expanded state',
      'the open menu lists Documents, Media library, Tags, Series, Operations and View site in order',
      'each menu item carries its declared destination href',
    ],
    remainsBrowser: [
      'the opened menu paints ztd-menu-enter at 0.15s and the closing menu paints ztd-menu-exit at 0.1s',
      'finishing the native exit animation unmounts the menu and returns native focus to its trigger',
    ],
  })),
  {
    playwright: at(navigation, 'compact admin menu keeps reduced motion, arrow keys and focus return at 390px'),
    lineage: [
      at(e2eMenu, 'admin section menu respects reduced motion and keyboard navigation'),
    ],
    dom: [
      at(adminNavigationDom, 'the reduced-motion admin menu remains operable from its keyboard trigger'),
    ],
    proves: [
      'the menu opens from the keyboard trigger, names its first section and updates aria-expanded',
      'Escape closes the menu and clears its expanded state',
    ],
    remainsBrowser: [
      'reduced motion removes the computed menu animation',
      'Enter delivers native focus to Documents, ArrowDown moves it to Media library, and Escape returns focus to the trigger',
    ],
  },
  {
    playwright: at(navigation, 'compact admin navigation keeps vertical space around its trigger'),
    lineage: [
      at(e2eAction, 'compact administration navigation leaves vertical space around its trigger'),
    ],
    dom: [
      at(adminNavigationDom, 'the compact navigation declares its named region and the active operation link'),
    ],
    proves: [
      'the compact section control is in the named Admin navigation region',
      'the active Operations destination keeps its /admin/operations href',
    ],
    remainsBrowser: [
      'the trigger keeps at least 7px above and below inside the navigation at 320, 390 and 768px',
      'the document has no horizontal scroll at each measured viewport width',
    ],
  },
  {
    playwright: at(services, 'bounded HTML paste preserves supported formatting and removes active content'),
    lineage: [
      at(e2eServices, 'bounded HTML paste preserves supported formatting and removes active content'),
    ],
    dom: [],
    proves: [],
    remainsBrowser: [
      'DataTransfer and ClipboardEvent deliver a native paste through the live BlockNote contenteditable and ProseMirror transaction',
      'the rendered heading, strong text, unsafe href and script assertions depend on BlockNote paste rendering',
      'the acknowledged save serializes the actual pasted editor document with unique block ids',
    ],
  },
  {
    playwright: at(services, 'scheduling locks publication and keeps the editor mounted while the request is pending'),
    lineage: [
      at(e2eServices, 'scheduling locks publication and keeps the editor mounted while the request is pending'),
    ],
    dom: [
      at(adminServicesDom, 'a held schedule request disables publish until the real schedule controller settles'),
    ],
    proves: [
      'a held schedule request disables Publish and the successful acknowledgement re-enables it',
      'the pending schedule appears with an enabled Cancel schedule action',
    ],
    remainsBrowser: [
      'the live editor contenteditable changes to false while the schedule request is held and back to true after it resolves',
      'the same native editor element stays connected across the held request and acknowledgement',
    ],
  },
  {
    playwright: at(services, 'catalog snapshots reach the save packet from the editor'),
    lineage: [
      at(e2eServices, 'catalog snapshots and schedule pinning are usable from the editor'),
    ],
    dom: [
      at(adminServicesDom, 'catalog selections enter the editor snapshot that the real draft client sends'),
    ],
    proves: [
      'selecting Snapshot tag through the real catalog control updates the editor envelope',
      'the real draft client sends the selected tag id, label and slug in its revision packet',
    ],
    remainsBrowser: [],
  },
  {
    playwright: at(state, 'inspector tabs preserve local settings and bilingual changes keep the native editor identity'),
    lineage: [
      at(e2ePolish, 'inspector tabs preserve local settings and bilingual changes keep the native editor identity'),
    ],
    dom: [
      at(adminStateDom, 'publication settings retain local timezone state across tabs and interface language changes'),
    ],
    proves: [
      'Asia/Tokyo stays selected after switching from Publication to Content and back',
      'the chosen timezone still renders as 发布时区 after switching the interface to Chinese',
    ],
    remainsBrowser: [
      'the live BlockNote body keeps its English paragraph and the same editor node remains connected after the language change',
    ],
  },
  {
    playwright: at(state, 'status badges share one geometry across locales and narrow layouts'),
    lineage: [
      at(e2eAction, 'status badges share geometry across locales and narrow layouts'),
    ],
    dom: [
      at(adminStateDom, 'save and publication badges expose the same state after an English-to-Chinese change'),
    ],
    proves: [
      'a real metadata input change puts SaveStatus in dirty/warning and the publication badge in draft',
      'the independent English and Chinese labels render for the same state',
    ],
    remainsBrowser: [
      'the badge height is 26px and its painted dot is 6px at 1440px, 320px and in Chinese',
      'save and draft badges have equal computed geometry and dirty status padding remains measurable',
      'the page does not scroll horizontally at the compact width',
    ],
  },
  {
    playwright: at(state, 'the unsaved-changes status keeps one appearance between the editor and the catalog page'),
    lineage: [
      at(e2eAction, 'the unsaved-changes status keeps one appearance between the editor and the catalog page'),
    ],
    dom: [
      at(adminStateDom, 'the catalog page and editor publish the same dirty SaveStatus contract'),
    ],
    proves: [
      'the editor header and catalog form both render dirty SaveStatus with the warning tone',
      'both surfaces render the independent Unsaved changes copy',
    ],
    remainsBrowser: [
      'computed background, foreground, radius, font, line height and padding match between the editor and catalog badges',
    ],
  },
  {
    playwright: at(state, '36 bilingual appearance states preserve the editor and have no axe violations'),
    lineage: [
      at(e2eAppearance, '36 bilingual appearance states preserve the editor and have no axe violations'),
    ],
    dom: [
      at(adminStateDom, '36 bilingual appearance choices change real preference state without writing a draft'),
    ],
    proves: [
      'all 36 literal mode/palette/locale combinations update the real selected radio state',
      'appearance changes send no write request',
    ],
    remainsBrowser: [
      'all 36 states pass axe against the real computed styles and accessibility tree',
      'the same live BlockNote editor element and English body content survive every appearance and language change',
    ],
  },
  {
    playwright: at(state, 'compact settings drawer keeps keyboard focus and axe on the editor at 320px'),
    lineage: [
      at(e2ePolish, 'compact navigation, filters and inspector use keyboard accessible overlays at 320px'),
    ],
    dom: [
      at(adminStateDom, 'the compact inspector exposes its reference dialog and close state'),
    ],
    proves: [
      'the real References settings section opens Add reference and renders its dialog',
      'Cancel removes the reference dialog and leaves the Content settings panel intact',
    ],
    remainsBrowser: [
      'the compact drawer and its tabs fit the 320px viewport and the document does not scroll horizontally',
      'axe scans the drawer against real computed styles and the accessibility tree',
      'Close returns native focus to the Document settings trigger while the live editor content stays mounted',
    ],
  },
  {
    playwright: at(ui, 'publication actions describe the live state and draft sync stays in the menu'),
    lineage: [
      at(e2eAction, 'publication actions describe the live state while draft synchronization stays in the menu'),
    ],
    dom: [
      at(adminUiDom, 'publication actions name the real live state and keep draft sync disabled while saved'),
    ],
    proves: [
      'a fresh draft names its publish action and keeps Sync draft now disabled',
      'publishing through the real action changes the header to the update-publication state',
    ],
    remainsBrowser: [],
  },
  {
    playwright: at(ui, 'clicking the document body outside its desktop actions menu preserves the writing focus'),
    lineage: [
      at(e2eAction, 'clicking the document body outside its desktop actions menu preserves the writing focus'),
    ],
    dom: [],
    proves: [],
    remainsBrowser: [
      'a real pointer click into the BlockNote contenteditable delivers native focus and a ProseMirror caret',
      'sequential typing lands at the caret left by that pointer event and the live editor saves the inserted text',
    ],
  },
  ...[390, 1440].map(width => ({
    playwright: at(ui, `dialog remains centered throughout opening and closing at ${width}px`),
    lineage: [
      at(e2eDialog, `dialog remains centered throughout opening and closing at ${width}px`),
    ],
    dom: [
      at(adminUiDom, 'the preview dialog reads the real draft and closes from its settings entry'),
    ],
    proves: [
      'the Preview settings entry opens the real Draft preview dialog with its reader region',
      'Close preview removes the dialog without issuing a write',
    ],
    remainsBrowser: [
      `the dialog center is measured at the start, middle and end of native enter and exit animations at ${width}px`,
      'Close preview receives native focus on open and the Preview trigger receives native focus after close',
    ],
  })),
  ...[320, 700].map(width => ({
    playwright: at(ui, `settings retain one scroll container and plain catalog fields at ${width}px`),
    lineage: [
      at(e2eInspector, `settings retain one scroll container and plain catalog fields at ${width}px`),
    ],
    dom: [
      at(adminUiDom, 'the settings panel renders labeled catalog fields without a fieldset'),
    ],
    proves: [
      'Tags and Series are the two catalog fields and neither is wrapped in a fieldset',
      'each real catalog combobox is associated with its own label and the Manage tags link points to /admin/tags',
    ],
    remainsBrowser: [
      `the ${width}px drawer has one measured scroll viewport, keeps its heading and Close control in view, and does not overflow horizontally`,
      'the drawer clips its own overflow and its Close action restores native focus to Document settings',
      'the Manage tags link has the computed transparent background',
    ],
  })),
  ...[320, 1440].map(width => ({
    playwright: at(ui, `block actions form a vertical menu below horizontal side controls at ${width}px`),
    lineage: [
      at(e2eInspector, `block actions form a vertical menu below horizontal side controls at ${width}px`),
    ],
    dom: [],
    proves: [],
    remainsBrowser: [
      'the native BlockNote side menu appears only after hovering the actual table block',
      'Add block and Open block menu bounds share a baseline and action boxes are measured as equal-width vertical targets',
      'Delete receives native focus, Escape closes the menu, and the action list stays inside the painted viewport',
      'the page remains free of horizontal overflow at the tested width',
    ],
  })),
]

/** Execution boundaries for interpreting the admin DOM retirement mapping. */
export const domGatePrerequisites: readonly string[] = [
  'Use the official test:dom config and the shared browser shims; they declare host media state but provide no CSS layout or native focus evidence.',
  'The editor boundary in editor-chrome-support supplies document data and a change listener only; it mounts the real controllers and components without BlockNote.',
  'The component plan proves only exact legacy case keys and the component migration lineage; this mapping does not run a browser case.',
]
