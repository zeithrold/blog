/* eslint-disable style/max-len -- Exact case keys and retained-boundary reasons stay on one line. */
import type { DomMigrationRecord } from './dom-migrations'

const formatting = 'tests/components/specs/editor-formatting.spec.ts'
const remaining = 'tests/components/specs/editor-format-remaining.spec.ts'
const dom = 'tests/dom/format-controls.test.tsx'

function at(file: string, title: string): string {
  return `${file} :: ${title}`
}

function bounded(width: number, locale: string): string {
  return `floating formatting is bounded at ${width}px in ${locale} and bold affects only its selected range`
}

function mobileAdvanced(width: number): string {
  return `mobile advanced formatting preserves selection and native actions at ${width}px`
}

function accessibility(width: number, locale: string): string {
  return `formatting controls are accessible at ${width}px in ${locale}`
}

function position(width: number): string {
  return `formatting follows multiline and backward cross-block selections at ${width}px`
}

const widths = [
  320,
  390,
  700,
  701,
  1440,
] as const
const locales = ['en', 'zh'] as const
const positionWidths = [
  700,
  701,
  1024,
] as const

const bold = at(dom, 'the real Bold control marks only the selected range, saves it, and undo restores plain text')
const colors = at(dom, 'the real color matrix applies and marks both colors on only the selected range')
const toolbarEn = at(dom, 'the real toolbar and advanced actions use en copy in compact and wide modes')
const toolbarZh = at(dom, 'the real toolbar and advanced actions use zh-CN copy in compact and wide modes')
const advanced = at(dom, 'the advanced toolbar applies Strike, centers the block, and nests then unnests a block')
const link = at(dom, 'the real Create link action saves the selected text with its requested destination')
const disabled = at(dom, 'the real toolbar opens for an editable selection, closes when disabled, and returns when enabled')
const selectedRange = at(dom, 'selecting a range shows the real toolbar without saving a draft')
const breakpoint = at(dom, 'the real options drawer closes at the breakpoint and the editor model keeps its selection')
const escape = at(dom, 'Escape closes the real floating toolbar and keeps the editor model selection')

/** Second-generation migration from the component slice to real-component jsdom cases. */
export const formattingDomMigrations: readonly DomMigrationRecord[] = [
  {
    id: 'editor.formatting-dom',
    legacy: [
      at(formatting, 'bold affects only the selected range and undo restores plain text'),
      at(formatting, 'the colour matrices mark their choice and apply it to the selected range'),
      at(formatting, 'fourteen Shift+ArrowRight presses retain the complete selection and a bounded toolbar'),
      ...widths.flatMap(width => locales.map(locale => at(remaining, bounded(width, locale)))),
      at(remaining, mobileAdvanced(320)),
      at(remaining, mobileAdvanced(390)),
      at(remaining, 'crossing the mobile breakpoint releases its drawer and retains the editor selection'),
      at(remaining, accessibility(320, 'zh')),
      at(remaining, accessibility(1440, 'en')),
      ...positionWidths.map(width => at(remaining, position(width))),
      at(remaining, 'keyboard viewport keeps the native toolbar and returns to selection positioning'),
      at(remaining, 'refocusing during the close animation measures the retained selection again'),
      at(remaining, 'rapid viewport changes finish at the current selection without stale placement'),
    ],
    dom: [
      {
        case: bold,
        proves: [
          'the real formatting toolbar marks only the selected text range and leaves the suffix plain',
          'the real draft hook and Client send the expected version, base revision, autosave reason and updated document',
          'the real BlockNote undo key restores the unformatted document',
        ],
      },
      {
        case: colors,
        proves: [
          'the real text and background color grids each render ten choices',
          'choosing blue text and yellow background marks both controls pressed and styles only the selected range',
          'the real revision request carries both chosen styles and leaves the suffix plain',
        ],
      },
      {
        case: toolbarEn,
        proves: [
          'the real compact English toolbar exposes its five named controls and no Strike action',
          'the real English options drawer names Strike, Colors, Create link, center alignment, Nest and Unnest',
          'the wide English toolbar exposes Strike, Colors and Create link while More is absent',
        ],
      },
      {
        case: toolbarZh,
        proves: [
          'the real compact Chinese toolbar exposes its five translated controls and no Strike action',
          'the real Chinese options drawer names Strike, Colors, Create link, center alignment, Nest and Unnest',
          'the wide Chinese toolbar exposes translated Strike, Colors and Create link while More is absent',
        ],
      },
      {
        case: advanced,
        proves: [
          'clicking the real drawer Strike action changes only the selected range',
          'the center action updates the real block alignment',
          'Nest then Unnest updates the real BlockNote document structure',
          'the resulting marks, alignment and block structure reach the revision request',
        ],
      },
      {
        case: link,
        proves: [
          'the real Create link action submits the requested URL around only the selected text',
          'the real revision request carries the link destination and leaves the suffix unlinked',
        ],
      },
      {
        case: disabled,
        proves: [
          'the real editing toolbar and options drawer open for an editable selection',
          'disabling editing closes the drawer and prevents More from reopening it',
          're-enabling editing restores the real toolbar and advanced drawer without a revision write',
        ],
      },
      {
        case: selectedRange,
        proves: [
          'a selection in the real editor model renders the real toolbar',
          'selection alone sends no revision write',
        ],
      },
      {
        case: breakpoint,
        proves: [
          'the real options drawer unmounts across the 700px/701px layout transition',
          'the editor model selection survives the transition in both directions',
          'the real editor DOM remains connected across the responsive change',
        ],
      },
      {
        case: escape,
        proves: [
          'Escape dismisses the real floating toolbar',
          'dismissing it leaves the editor model range unchanged and sends no revision write',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(formatting, 'the colour matrices mark their choice and apply it to the selected range'),
        ],
        reason: 'Split: jsdom proves matrix inventory, pressed state, selected-range styles and request shape; the desktop case keeps the five-column grid, blue/yellow popover choices, Escape dismissal and editor focus return.',
      },
      {
        cases: [
          at(formatting, 'fourteen Shift+ArrowRight presses retain the complete selection and a bounded toolbar'),
        ],
        reason: 'Split: jsdom proves model-selection toolbar wiring and no-write behavior; this keeps browser Shift+Arrow selection, focus delivery and 701px toolbar bounds.',
      },
      {
        cases: widths.flatMap(width => locales.map(locale => at(remaining, bounded(width, locale)))),
        reason: 'Split: jsdom proves localized controls, Bold effects and request shape; the component cases keep native selection and measured viewport/target geometry at each width.',
      },
      {
        cases: [
          at(remaining, mobileAdvanced(320)),
          at(remaining, mobileAdvanced(390)),
        ],
        reason: 'Split: jsdom proves drawer actions and document effects; at 320px zh and 390px en, Enter on focused Strike renders <s>Selected phrase</s> with the suffix plain, alongside native focus/geometry residuals.',
      },
      {
        cases: [
          at(remaining, 'crossing the mobile breakpoint releases its drawer and retains the editor selection'),
        ],
        reason: 'Split: jsdom proves drawer release, toolbar inventory and model selection; the component case keeps native selection continuity and measured toolbar/drawer bounds.',
      },
      {
        cases: [
          at(remaining, accessibility(320, 'zh')),
          at(remaining, accessibility(1440, 'en')),
        ],
        reason: 'Split: jsdom proves control copy and states; the component cases keep reduced-motion computed styles and Axe scans against the real browser surfaces.',
      },
      {
        cases: positionWidths.map(width => at(remaining, position(width))),
        reason: 'Split: jsdom proves formatting command effects; these keep cross-block browser ranges, Axe, Escape dismissal with native focus return, and measured placement through scroll/resize.',
      },
      {
        cases: [
          at(remaining, 'keyboard viewport keeps the native toolbar and returns to selection positioning'),
        ],
        reason: 'Split: jsdom proves the floating Bold command and request; the virtual-keyboard toolbar tap renders <strong>A selection</strong> with the suffix plain on its independent branch, whose placement stays native.',
      },
      {
        cases: [
          at(remaining, 'refocusing during the close animation measures the retained selection again'),
        ],
        reason: 'Unsplit native remainder: refocus during close animation only proves browser focus delivery and measured re-placement of its live selection.',
      },
      {
        cases: [
          at(remaining, 'rapid viewport changes finish at the current selection without stale placement'),
        ],
        reason: 'Split: jsdom proves the Bold request; after rapid viewport changes the native entry still renders <strong>Selected range</strong> with the suffix plain, alongside the native selection and final measured placement.',
      },
    ],
  },
]
