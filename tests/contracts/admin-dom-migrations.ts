/* eslint-disable style/max-len -- Exact case keys and retirement reasons stay on one line. */
import type { DomMigrationRecord } from './dom-migrations'

const controls = 'tests/components/specs/admin-controls.spec.ts'
const navigation = 'tests/components/specs/admin-navigation.spec.ts'
const services = 'tests/components/specs/admin-editor-services.spec.ts'
const state = 'tests/components/specs/admin-editor-state.spec.ts'
const ui = 'tests/components/specs/admin-editor-ui.spec.ts'
const controlsDom = 'tests/dom/admin-controls.test.tsx'
const navigationDom = 'tests/dom/admin-navigation.test.tsx'
const servicesDom = 'tests/dom/admin-editor-services.test.tsx'
const stateDom = 'tests/dom/admin-editor-state.test.tsx'
const uiDom = 'tests/dom/admin-editor-ui.test.tsx'

function at(file: string, title: string): string {
  return `${file} :: ${title}`
}

const navigationWidths = [390, 800] as const
const settingsWidths = [320, 700] as const
const dialogWidths = [390, 1440] as const
const blockWidths = [320, 1440] as const

/** Component-to-DOM case links for the admin surfaces; no contract ids are assigned here. */
export const adminDomMigrations: readonly DomMigrationRecord[] = [
  {
    id: 'admin.controls',
    legacy: [
      at(controls, 'admin Selects keep one text gutter, a centered right check and animate in and out'),
      at(controls, 'compact admin Selects keep options aligned and respect reduced motion at 320px'),
    ],
    dom: [
      {
        case: at(controlsDom, 'the document type filter opens its real choices and sends the chosen type'),
        proves: [
          'the document type filter exposes All types, Post and Page',
          'choosing Post sends kind=article through the real document-list client',
        ],
      },
      {
        case: at(controlsDom, 'the compact admin controls use Chinese choices and respect the declared mobile host'),
        proves: [
          'the host reports a 320px viewport and reduced-motion preference without selecting a product branch',
          'switching language renders the Chinese document type choices 所有类型, 文章 and 页面',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(controls, 'admin Selects keep one text gutter, a centered right check and animate in and out'),
          at(controls, 'compact admin Selects keep options aligned and respect reduced motion at 320px'),
        ],
        reason: 'The component cases keep measured Select option geometry, native menu animation and native focus delivery after ArrowDown/Escape.',
      },
    ],
  },
  {
    id: 'admin.navigation',
    legacy: [
      ...navigationWidths.map(width => at(navigation, `compact admin menu animates opening and closing at ${width}px`)),
      at(navigation, 'compact admin menu keeps reduced motion, arrow keys and focus return at 390px'),
      at(navigation, 'compact admin navigation keeps vertical space around its trigger'),
    ],
    dom: [
      ...navigationWidths.map(width => ({
        case: at(navigationDom, `the compact admin menu lists the current section and every destination at ${width}px`),
        proves: [
          'the Operations trigger reports its current section and expanded state',
          'the open menu lists each section and its declared destination href in order',
        ],
      })),
      {
        case: at(navigationDom, 'the reduced-motion admin menu remains operable from its keyboard trigger'),
        proves: [
          'the menu opens from the keyboard trigger and updates aria-expanded',
          'Escape closes the menu and clears its expanded state',
        ],
      },
      {
        case: at(navigationDom, 'the compact navigation declares its named region and the active operation link'),
        proves: [
          'the compact section control is in the named Admin navigation region',
          'the active Operations destination keeps its /admin/operations href',
        ],
      },
    ],
    retained: [
      {
        cases: [
          ...navigationWidths.map(width => at(navigation, `compact admin menu animates opening and closing at ${width}px`)),
        ],
        reason: 'The component cases keep computed enter/exit animation names and durations, unmount after exit and native focus return.',
      },
      {
        cases: [
          at(navigation, 'compact admin menu keeps reduced motion, arrow keys and focus return at 390px'),
        ],
        reason: 'The browser case keeps the computed reduced-motion animation and native focus delivery across Enter, ArrowDown and Escape.',
      },
      {
        cases: [
          at(navigation, 'compact admin navigation keeps vertical space around its trigger'),
        ],
        reason: 'The browser case measures trigger insets and document overflow at 320, 390 and 768px.',
      },
    ],
  },
  {
    id: 'admin.editor-services',
    legacy: [
      at(services, 'bounded HTML paste preserves supported formatting and removes active content'),
      at(services, 'scheduling locks publication and keeps the editor mounted while the request is pending'),
      at(services, 'catalog snapshots reach the save packet from the editor'),
    ],
    dom: [
      {
        case: at(servicesDom, 'a held schedule request disables publish until the real schedule controller settles'),
        proves: [
          'a held schedule request disables Publish and the successful acknowledgement re-enables it',
          'the pending schedule appears with an enabled Cancel schedule action',
        ],
      },
      {
        case: at(servicesDom, 'catalog selections enter the editor snapshot that the real draft client sends'),
        proves: [
          'selecting Snapshot tag through the real catalog control updates the editor envelope',
          'the real draft client sends the selected tag id, label and slug in its revision packet',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(services, 'bounded HTML paste preserves supported formatting and removes active content'),
        ],
        reason: 'DataTransfer, ClipboardEvent, BlockNote paste rendering and the ProseMirror transaction require the native editor engine.',
      },
      {
        cases: [
          at(services, 'scheduling locks publication and keeps the editor mounted while the request is pending'),
        ],
        reason: 'The browser case keeps contenteditable read-only state and identity of the live BlockNote editor node through the held request.',
      },
    ],
  },
  {
    id: 'admin.editor-state',
    legacy: [
      at(state, 'inspector tabs preserve local settings and bilingual changes keep the native editor identity'),
      at(state, 'status badges share one geometry across locales and narrow layouts'),
      at(state, 'the unsaved-changes status keeps one appearance between the editor and the catalog page'),
      at(state, '36 bilingual appearance states preserve the editor and have no axe violations'),
      at(state, 'compact settings drawer keeps keyboard focus and axe on the editor at 320px'),
    ],
    dom: [
      {
        case: at(stateDom, 'publication settings retain local timezone state across tabs and interface language changes'),
        proves: [
          'Asia/Tokyo stays selected after switching from Publication to Content and back',
          'the chosen timezone still renders as 发布时区 after switching the interface to Chinese',
        ],
      },
      {
        case: at(stateDom, 'save and publication badges expose the same state after an English-to-Chinese change'),
        proves: [
          'a real metadata input change puts SaveStatus in dirty/warning and the publication badge in draft',
          'the independent English and Chinese labels render for the same state',
        ],
      },
      {
        case: at(stateDom, 'the catalog page and editor publish the same dirty SaveStatus contract'),
        proves: [
          'the editor header and catalog form both render dirty SaveStatus with the warning tone',
          'both surfaces render the independent Unsaved changes copy',
        ],
      },
      {
        case: at(stateDom, '36 bilingual appearance choices change real preference state without writing a draft'),
        proves: [
          'all 36 literal mode/palette/locale combinations update the real selected radio state',
          'appearance changes send no write request',
        ],
      },
      {
        case: at(stateDom, 'the compact inspector exposes its reference dialog and close state'),
        proves: [
          'the real References settings section opens Add reference and renders its dialog',
          'Cancel removes the reference dialog and leaves the Content settings panel intact',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(state, 'inspector tabs preserve local settings and bilingual changes keep the native editor identity'),
        ],
        reason: 'The component case keeps the live BlockNote paragraph and element identity through a settings-language change.',
      },
      {
        cases: [
          at(state, 'status badges share one geometry across locales and narrow layouts'),
        ],
        reason: 'The browser measures badge height, painted dot size, padding, equality of computed geometry and compact page overflow.',
      },
      {
        cases: [
          at(state, 'the unsaved-changes status keeps one appearance between the editor and the catalog page'),
        ],
        reason: 'The component case compares computed colors, typography, radius and padding between the actual editor and catalog surfaces.',
      },
      {
        cases: [
          at(state, '36 bilingual appearance states preserve the editor and have no axe violations'),
        ],
        reason: 'The accessibility scanner requires real computed styles and an accessibility tree, and the live BlockNote identity stays browser evidence.',
      },
      {
        cases: [
          at(state, 'compact settings drawer keeps keyboard focus and axe on the editor at 320px'),
        ],
        reason: 'The component case keeps compact drawer layout/scroll measurements, axe against real styles and native focus return.',
      },
    ],
  },
  {
    id: 'admin.editor-ui',
    legacy: [
      at(ui, 'publication actions describe the live state and draft sync stays in the menu'),
      at(ui, 'clicking the document body outside its desktop actions menu preserves the writing focus'),
      ...dialogWidths.map(width => at(ui, `dialog remains centered throughout opening and closing at ${width}px`)),
      ...settingsWidths.map(width => at(ui, `settings retain one scroll container and plain catalog fields at ${width}px`)),
      ...blockWidths.map(width => at(ui, `block actions form a vertical menu below horizontal side controls at ${width}px`)),
    ],
    dom: [
      {
        case: at(uiDom, 'publication actions name the real live state and keep draft sync disabled while saved'),
        proves: [
          'a fresh draft names its publish action and keeps Sync draft now disabled',
          'publishing through the real action changes the header to the update-publication state',
        ],
      },
      {
        case: at(uiDom, 'the preview dialog reads the real draft and closes from its settings entry'),
        proves: [
          'the Preview settings entry opens the real Draft preview dialog with its reader region',
          'Close preview removes the dialog without issuing a write',
        ],
      },
      {
        case: at(uiDom, 'the settings panel renders labeled catalog fields without a fieldset'),
        proves: [
          'Tags and Series are the two catalog fields and neither is wrapped in a fieldset',
          'each real catalog combobox is associated with its own label and the Manage tags link points to /admin/tags',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(ui, 'clicking the document body outside its desktop actions menu preserves the writing focus'),
        ],
        reason: 'A real pointer click into the BlockNote contenteditable must deliver native focus and a ProseMirror caret for sequential typing.',
      },
      {
        cases: dialogWidths.map(width => at(ui, `dialog remains centered throughout opening and closing at ${width}px`)),
        reason: 'The browser cases measure native dialog centers during enter/exit frames and verify focus delivery to Close preview and its trigger.',
      },
      {
        cases: settingsWidths.map(width => at(ui, `settings retain one scroll container and plain catalog fields at ${width}px`)),
        reason: 'The compact drawer requires measured scroll geometry, viewport fitting and native focus return after Close.',
      },
      {
        cases: blockWidths.map(width => at(ui, `block actions form a vertical menu below horizontal side controls at ${width}px`)),
        reason: 'The real BlockNote side menu needs a hovered editor block and native geometry for its targets and viewport bounds.',
      },
    ],
  },
]
