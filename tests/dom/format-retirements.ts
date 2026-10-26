/* eslint-disable style/max-len -- One exact historical case and its per-assertion split per row. */
/* eslint-disable max-lines -- Keep the per-case native assertion ledger together. */

export type FormatRetainedAssertion = {
  readonly assertion: string
  readonly reason: string
}

export type FormatRetirement = {
  /** The historical Playwright key, unchanged even when only its native residual remains. */
  readonly playwright: string
  /** Assertions now carried by real-component jsdom cases. */
  readonly moved: readonly string[]
  /** Assertions still requiring a browser, each with its own boundary reason. */
  readonly retained: readonly FormatRetainedAssertion[]
}

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

function mobileLocale(width: number): string {
  return width === 320 ? 'zh' : 'en'
}

function accessibility(width: number, locale: string): string {
  return `formatting controls are accessible at ${width}px in ${locale}`
}

function position(width: number): string {
  return `formatting follows multiline and backward cross-block selections at ${width}px`
}

const boundedWidths = [
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
const boldDom = at(dom, 'the real Bold control marks only the selected range, saves it, and undo restores plain text')
const selectionDom = at(dom, 'selecting a range shows the real toolbar without saving a draft')
const localeEnglishDom = at(dom, 'the real toolbar and advanced actions use en copy in compact and wide modes')
const localeChineseDom = at(dom, 'the real toolbar and advanced actions use zh-CN copy in compact and wide modes')
const colorDom = at(dom, 'the real color matrix applies and marks both colors on only the selected range')
const advancedDom = at(dom, 'the advanced toolbar applies Strike, centers the block, and nests then unnests a block')
const linkDom = at(dom, 'the real Create link action saves the selected text with its requested destination')
const breakpointDom = at(dom, 'the real options drawer closes at the breakpoint and the editor model keeps its selection')

const movedToolbar = [
  `${localeEnglishDom} and ${localeChineseDom}: localized compact/wide control inventory and action names`,
  `${boldDom}: Bold changes only the selected range, preserves the suffix, and reaches the revision request`,
  `${selectionDom}: an editor-model range opens the real toolbar without saving`,
]

function compactTargetAssertions(width: number): FormatRetainedAssertion[] {
  if (width > 700) {
    return []
  }
  return [
    {
      assertion: 'the five compact toolbar targets are at least 44px and share one measured row',
      reason: `Hit-target dimensions and the shared row baseline at ${width}px require painted browser layout.`,
    },
  ]
}

/** Assertion-level account of each retained native remainder in the formatting specs. */
export const formatRetirements: readonly FormatRetirement[] = [
  {
    playwright: at(formatting, 'the colour matrices mark their choice and apply it to the selected range'),
    moved: [
      `${colorDom}: matrix inventory, pressed choices, selected-range styles, and revision request`,
    ],
    retained: [
      {
        assertion: 'the text-color matrix occupies five measured browser columns',
        reason: 'Column count is a painted layout measurement; jsdom supplies no CSS geometry.',
      },
      {
        assertion: 'the desktop floating color popup receives Blue text and Yellow background activation before Escape',
        reason: 'This keeps the desktop popover entry path; DOM carries the resulting selected-range marks and request.',
      },
      {
        assertion: 'Escape hides the desktop color popup and returns focus to the editor body',
        reason: 'Native focus delivery and popup dismissal are browser behavior.',
      },
    ],
  },
  {
    playwright: at(formatting, 'fourteen Shift+ArrowRight presses retain the complete selection and a bounded toolbar'),
    moved: [
      `${selectionDom}: a selected editor-model range opens the real toolbar without writing`,
      `${boldDom}: selected text and unchanged suffix are asserted in the saved document`,
    ],
    retained: [
      {
        assertion: 'fourteen native Shift+ArrowRight key presses create the complete browser selection',
        reason: 'The caret and range created by real browser keyboard delivery are native selection behavior.',
      },
      {
        assertion: 'the toolbar width and right edge remain within the 701px viewport',
        reason: 'Toolbar bounds are measured from the browser layout engine.',
      },
      {
        assertion: 'the editor body receives focus before the native range is extended',
        reason: 'Native focus delivery determines which contenteditable receives Shift+ArrowRight.',
      },
    ],
  },
  ...boundedWidths.flatMap(width => locales.map((locale): FormatRetirement => ({
    playwright: at(remaining, bounded(width, locale)),
    moved: movedToolbar,
    retained: [
      {
        assertion: 'the browser-created range selects exactly the phrase and leaves its suffix outside the range',
        reason: `The native selection string is observed at ${width}px in ${locale} after the browser Range API creates it.`,
      },
      {
        assertion: 'the toolbar stays within the viewport and respects its width cap',
        reason: `Viewport containment and the ${width}px toolbar width are measured from real browser geometry.`,
      },
      ...compactTargetAssertions(width),
    ],
  }))),
  ...[320, 390].map((width): FormatRetirement => ({
    playwright: at(remaining, mobileAdvanced(width)),
    moved: [
      `${localeEnglishDom} and ${localeChineseDom}: drawer inventory and localized action names`,
      `${advancedDom}: Strike and center alignment update the real document model`,
      `${colorDom}: selected text/background colors and their request shape`,
      `${linkDom}: Create link carries the requested URL and selected text to the save request`,
    ],
    retained: [
      {
        assertion: 'the browser selection survives Escape from the compact options drawer',
        reason: 'A DOM-model selection cannot establish native selection preservation across a browser modal close.',
      },
      {
        assertion: 'closing the options drawer returns native focus to the editor',
        reason: 'Focus restoration is delivered by the browser focus engine.',
      },
      {
        assertion: 'opening the drawer focuses Close and Tab delivers focus to Strike',
        reason: 'Native focus order and keyboard focus delivery are browser behavior.',
      },
      {
        assertion: `Enter on focused Strike renders one <s> around only the selected phrase, with the suffix plain, at ${width}px in ${mobileLocale(width)}`,
        reason: `The focused keyboard route at ${width}px in ${mobileLocale(width)} is a distinct native entry; its local <s> result stays beside that route.`,
      },
      {
        assertion: `the compact drawer remains inside the ${width}px viewport`,
        reason: `The drawer bounds at ${width}px are measured from real browser geometry.`,
      },
      {
        assertion: 'the blue color target is viewport-contained and at least 44px square',
        reason: `The blue target size and viewport containment at ${width}px require painted browser layout.`,
      },
      {
        assertion: `the link URL field remains inside the ${width}px viewport`,
        reason: `The link form bounds at ${width}px are measured from real browser geometry.`,
      },
    ],
  })),
  {
    playwright: at(remaining, 'crossing the mobile breakpoint releases its drawer and retains the editor selection'),
    moved: [
      `${breakpointDom}: the compact drawer closes at 701px and the real editor retains its model range`,
      `${localeEnglishDom}: compact and wide toolbar control inventories`,
    ],
    retained: [
      {
        assertion: 'the browser-created selection survives the 700px → 701px → 700px transition',
        reason: 'Responsive rebuilding must preserve the actual browser selection, not only a model range.',
      },
      {
        assertion: 'the compact drawer is contained at the 700px breakpoint',
        reason: 'The drawer is measured against the real browser viewport.',
      },
      {
        assertion: 'toolbar bounds remain within the viewport on both sides of the breakpoint',
        reason: 'The 700px and 701px toolbar widths and containment use browser layout measurements.',
      },
    ],
  },
  {
    playwright: at(remaining, accessibility(320, 'zh')),
    moved: [
      `${localeChineseDom}: compact translated controls and options are checked against the real components`,
    ],
    retained: [
      {
        assertion: 'the compact toolbar transition duration is zero under reduced-motion emulation',
        reason: 'Computed transition style under native media emulation is read from the browser.',
      },
      {
        assertion: 'Axe reports no violations for the Chinese compact toolbar',
        reason: 'The native browser accessibility scan covers rendered semantics and computed styling.',
      },
      {
        assertion: 'the options drawer stays within the 320px viewport',
        reason: 'The drawer is measured against the real browser viewport.',
      },
      {
        assertion: 'the drawer animation duration is zero under reduced-motion emulation',
        reason: 'Computed animation style under native media emulation is read from the browser.',
      },
      {
        assertion: 'Axe reports no violations for the compact options drawer',
        reason: 'The native browser accessibility scan covers the rendered dialog state.',
      },
    ],
  },
  {
    playwright: at(remaining, accessibility(1440, 'en')),
    moved: [
      `${localeEnglishDom}: wide translated controls and advanced action names are checked against the real components`,
    ],
    retained: [
      {
        assertion: 'the wide toolbar transition duration is zero under reduced-motion emulation',
        reason: 'Computed transition style under native media emulation is read from the browser.',
      },
      {
        assertion: 'Axe reports no violations for the wide toolbar',
        reason: 'The native browser accessibility scan covers rendered semantics and computed styling.',
      },
    ],
  },
  ...positionWidths.map((width): FormatRetirement => ({
    playwright: at(remaining, position(width)),
    moved: [
      `${advancedDom}: real formatting commands update the selected BlockNote document`,
    ],
    retained: [
      {
        assertion: 'forward and backward browser selections span the intended cross-block range',
        reason: 'The test constructs and reads a native browser range across separate contenteditables.',
      },
      {
        assertion: 'the floating toolbar tracks the range through scroll and resize while clearing the measured header gap',
        reason: `Selection-relative position and the header gap at ${width}px require browser layout geometry.`,
      },
      {
        assertion: `Axe reports no violations for the formatting surface at ${width}px`,
        reason: 'A real browser accessibility scan remains separate from jsdom semantics.',
      },
      {
        assertion: 'Escape hides the floating toolbar after the native key event',
        reason: 'Escape dismissal stays with the native event and the browser-created selection.',
      },
      {
        assertion: 'Escape returns native focus to the editor body',
        reason: 'Focus restoration after native keyboard dismissal is browser behavior.',
      },
    ],
  })),
  {
    playwright: at(remaining, 'keyboard viewport keeps the native toolbar and returns to selection positioning'),
    moved: [
      `${boldDom}: Bold applies to the selected text and saves the updated document`,
    ],
    retained: [
      {
        assertion: 'the selected browser range positions the floating toolbar before the viewport changes',
        reason: 'The range and its toolbar anchor are measured in the browser layout engine.',
      },
      {
        assertion: 'a visualViewport height change mounts the native mobile toolbar inside the viewport',
        reason: 'The native toolbar branch responds to browser visualViewport events and measured bounds.',
      },
      {
        assertion: 'restoring visualViewport height removes the mobile toolbar and restores selection positioning',
        reason: 'The native viewport event and returned placement require browser geometry.',
      },
      {
        assertion: 'tapping mobile Bold renders one <strong> around the selection and leaves the suffix plain',
        reason: 'This result is asserted through the independent virtual-keyboard toolbar controller and native tap path.',
      },
    ],
  },
  {
    playwright: at(remaining, 'refocusing during the close animation measures the retained selection again'),
    moved: [],
    retained: [
      {
        assertion: 'the browser selection remains intact while focus moves to the title and back to the editor',
        reason: 'The test depends on native focus delivery while a browser-created range remains selected.',
      },
      {
        assertion: 'the toolbar remeasures the range after refocus and scrolling during its close animation',
        reason: 'Selection-relative placement through a close animation is measured browser geometry.',
      },
    ],
  },
  {
    playwright: at(remaining, 'rapid viewport changes finish at the current selection without stale placement'),
    moved: [
      `${boldDom}: Bold changes only the selected model text and reaches the revision request`,
    ],
    retained: [
      {
        assertion: 'the browser selection remains the same through rapid viewport changes',
        reason: 'The range is created and read by the native browser selection API.',
      },
      {
        assertion: 'the toolbar stays visible below the header and within the viewport beside the selected range',
        reason: 'Opacity, viewport containment, header gap and selection proximity require painted browser geometry.',
      },
      {
        assertion: 'Bold still renders one <strong> around the current range after the resize race',
        reason: 'The local result proves the browser selection is still the command target after rapid resizing.',
      },
    ],
  },
]
