/* eslint-disable style/max-len -- One row per old assertion, with verbatim references on one line. */

/*
 * Per-assertion retirement record for the editor draft-conflict component cases.
 *
 * Scope: the one pending-notice case and the six width/locale choice cases in
 * `editor-history-remaining-conflict.spec.ts`. The two accessibility-scanner cases
 * are deliberately absent: no assertion of theirs moves, because an axe scan of
 * computed styles and the accessibility tree is a browser fact.
 *
 * Every assertion of every old case gets a destination:
 * - `dom`: proved by a case in `history-conflict-remaining.test.tsx`, running the
 *   real coordinator, client, notice, comparison and diff over a declared `fetch`
 *   table with the BlockNote editor reduced to its document data and change hook.
 * - `retained-pw`: needs the engine, so the component case keeps it with the
 *   narrow subject named here.
 * - `dropped`: a diagnostic capture, not an assertion.
 *
 * The old case titles stay as they are: they name the behaviour the browser case
 * still owns, and its body no longer claims the assertions that moved. Where the
 * component case still repeats a rule the DOM case proves (the request log after
 * keep→cancel and after an unavailable recovery copy), that repetition is a
 * safety net for the native wiring, not evidence that jsdom cannot hold it.
 */

export type AssertionDestination
  = | 'dom'
    | 'retained-pw'
    | 'dropped'

export type AssertionMapping = {
  readonly assertion: string
  readonly destination: AssertionDestination
  readonly where: string
  readonly reason?: string
}

export type ConflictCaseRetirement = {
  readonly id: string
  readonly oldCase: string
  readonly dom: readonly string[]
  readonly assertions: readonly AssertionMapping[]
}

const D = 'tests/dom/history-conflict-remaining.test.tsx'
const C = 'tests/components/specs/editor-history-remaining-conflict.spec.ts'

function c(file: string, title: string): string {
  return `${file} :: ${title}`
}

function a(
  assertion: string,
  destination: AssertionDestination,
  where: string,
  reason?: string,
): AssertionMapping {
  return { assertion, destination, where, ...(reason === undefined ? {} : { reason }) }
}

const pending = c(D, 'a pending conflict refresh explains preserved document edits and merges into one actionable notice')
const pendingSpec = c(C, 'a pending conflict refresh explains preserved document edits and merges into one actionable notice')

function domChoices(locale: 'en' | 'zh-CN'): string {
  return c(D, `conflict choices describe both drafts and the refreshed comparison in ${locale}`)
}

const widths = [
  320,
  390,
  1440,
] as const
const locales = ['en', 'zh'] as const

/**
 * What one width/locale case carries. A jsdom mount has no layout, so every width
 * shares its locale's DOM case; only the browser entries name a width.
 */
function choicesAssertions(input: {
  readonly width: number
  readonly locale: 'en' | 'zh'
}): readonly AssertionMapping[] {
  const old = c(C, `conflict choices and refreshed comparison remain accessible at ${input.width}px in ${input.locale}`)
  // The Playwright case names the locale `zh`; the page renders `zh-CN`.
  const dom = domChoices(input.locale === 'en' ? 'en' : 'zh-CN')
  return [
    a('the conflict notice region is rendered with its heading and description', 'dom', dom),
    a('the conflict notice is painted and stays inside the viewport', 'retained-pw', old, 'Painted visibility and horizontalBounds are layout.'),
    a('the editor body holds this window\'s local paragraph', 'retained-pw', old, 'The live BlockNote body; the DOM case reads the snapshot the coordinator would save.'),
    a('exactly one conflict-tone notice is shown and no generic error notice competes with it', 'dom', dom),
    a('no alert is shown once the merged notice owns the conflict', 'dom', dom),
    a('the notice names no catalog concept', 'dom', dom),
    a('the notice icon is painted', 'retained-pw', old, 'Painted SVG; the DOM case proves only that the icon element is present.'),
    a('the compare control is a ghost disclosure, collapsed before comparing', 'dom', dom),
    a('the compare control\'s icon is painted', 'retained-pw', old, 'Painted SVG.'),
    a('both conflict choices are outlined', 'dom', dom),
    a('both conflict choices carry painted icons', 'retained-pw', old, 'Painted SVG.'),
    a('each choice is described by its own help text through aria-describedby', 'dom', dom),
    a('each conflict action stays inside the viewport', 'retained-pw', old, 'horizontalBounds is layout.'),
    a('each conflict action keeps a 44px target at 320/390px', 'retained-pw', old, 'Target geometry.'),
    a('the collapsed notice is screenshotted', 'dropped', old, 'PNG is a diagnostic capture, not an assertion.'),
    a('comparing expands the comparison and renders the differences region', 'dom', dom),
    a('the changed paragraph appears exactly once', 'dom', dom),
    a('the changed paragraph opens with the server draft before and the local draft after', 'dom', dom),
    a('the expanded changed row stays inside the viewport', 'retained-pw', old, 'horizontalBounds is layout.'),
    a('the expanded comparison is screenshotted', 'dropped', old, 'PNG is a diagnostic capture, not an assertion.'),
    a('the disclosure collapses and reopens the same comparison', 'dom', dom),
    a('editing after a comparison marks it stale in a status role with its copy', 'dom', dom),
    a('comparing again replaces the stale comparison with the new local draft', 'dom', dom),
    a('cancelling the replacement dialog returns focus to the keep control', 'retained-pw', old, 'Native focus return.'),
    a('the replacement dialog opens from the keep control and closes on cancel', 'dom', dom),
    a('the live editor element survives opening and cancelling the confirmation', 'retained-pw', old, 'Editor element identity.'),
    a('the body keeps the local paragraph edited after the comparison', 'retained-pw', old, 'The live BlockNote body.'),
    a('only the refused revision save is attempted through comparing and the stale recompute', 'dom', dom),
    a('cancelling the replacement dialog writes no second save', 'dom', dom),
    a('an unavailable recovery copy keeps the conflict draft, writes no publication and does not reopen', 'dom', dom),
    a('using the server version replaces the body with the server paragraph', 'retained-pw', old, 'A successful reopen needs a real recovery copy and the live editor body.'),
    a('the conflict notice is gone after opening the server version', 'retained-pw', old, 'The same successful reopen.'),
    a('no publication write is attempted through comparing and the stale recompute', 'dom', dom),
    a('no publication write is attempted when the server version is opened', 'dom', dom, 'The unavailable-recovery branch is proved in jsdom; the component case re-checks it after a successful reopen.'),
    a('every request is served', 'dom', dom, 'The stub teardown fails on an unmatched request.'),
  ]
}

export const historyConflictRetirements: readonly ConflictCaseRetirement[] = [
  {
    id: 'history.conflict-pending-notice',
    oldCase: pendingSpec,
    dom: [pending],
    assertions: [
      a('the pending notice is rendered while the newer draft is being read', 'dom', pending),
      a('the pending notice\'s alert says the local edits are preserved', 'dom', pending),
      a('the pending notice names no catalog concept', 'dom', pending),
      a('exactly one conflict-tone notice is shown while the read is held', 'dom', pending),
      a('the pending notice is visible and stays inside 320px', 'retained-pw', pendingSpec, 'Painted visibility and horizontalBounds are layout.'),
      a('the editor body still holds this window\'s paragraph', 'retained-pw', pendingSpec, 'The live BlockNote body; the DOM case reads the snapshot the coordinator would save.'),
      a('the held pending notice is screenshotted', 'dropped', pendingSpec, 'PNG is a diagnostic capture, not an assertion.'),
      a('the merged notice appears when the newer draft lands', 'dom', pending),
      a('the pending notice is gone once the merged notice renders', 'dom', pending),
      a('no alert remains after the merge', 'dom', pending),
      a('exactly one conflict-tone notice remains after the merge', 'dom', pending),
      a('no publication write is sent', 'dom', pending),
      a('every request is served', 'dom', pending, 'The stub teardown fails on an unmatched request.'),
    ],
  },
  ...widths.flatMap(width => locales.map((locale): ConflictCaseRetirement => ({
    id: `history.conflict-choices-${width}-${locale}`,
    oldCase: c(C, `conflict choices and refreshed comparison remain accessible at ${width}px in ${locale}`),
    dom: [
      domChoices(locale === 'en' ? 'en' : 'zh-CN'),
    ],
    assertions: choicesAssertions({ width, locale }),
  }))),
]

/**
 * What is still browser-only after these retirements, and why.
 *
 * Nothing here is a pending migration: each line names the engine fact the jsdom
 * layer cannot hold. The two accessibility-scanner cases are in the same position
 * and keep their assertions unchanged.
 */
export const historyConflictResiduals: readonly string[] = [
  'the live BlockNote body: the paragraph the author typed, the editor element that survives the confirmation dialog, and the reopened server draft',
  'the request log after the actions is proved in jsdom too; the successful reopen (real recovery copy → replacement body) and the live editor element remain browser facts',
  'painted SVG icons (jsdom proves presence, not paint)',
  '44px targets and horizontalBounds at 320/390px',
  'native focus return to the keep control after cancelling the confirmation dialog',
  'axe scans against computed styles and the accessibility tree',
]
