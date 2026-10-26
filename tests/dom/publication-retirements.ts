/* eslint-disable style/max-len, max-lines -- Per-assertion evidence references stay on one line. */

/*
 * Per-assertion retirement record for the publication Playwright component cases.
 *
 * No old case is deleted in this change. For each old case, every assertion is
 * assigned a destination:
 * - `dom`: proved by a case in this directory.
 * - `retained-pw`: still needs the component browser, with the narrow subject.
 * - `unit`: a pure rule owned by a Node unit case.
 * - `dropped`: a diagnostic capture, not an assertion.
 *
 * A case is only retired once every non-dropped assertion has a passing
 * destination in the native gate.
 */

export type AssertionDestination
  = | 'dom'
    | 'retained-pw'
    | 'unit'
    | 'dropped'

export type AssertionMapping = {
  readonly assertion: string
  readonly destination: AssertionDestination
  readonly where: string
  readonly reason?: string
}

export type PublicationCaseRetirement = {
  readonly id: string
  readonly oldCase: string
  readonly dom: readonly string[]
  readonly assertions: readonly AssertionMapping[]
}

const D = 'tests/dom'
const C = 'tests/components/specs'

function c(file: string, title: string): string {
  return `${file} :: ${title}`
}

function d(file: string, title: string): string {
  return c(`${D}/${file}`, title)
}

function pw(file: string, title: string): string {
  return c(`${C}/${file}`, title)
}

function locateId(title: string): string {
  let subject = 'delete'
  if (title.includes('nested')) {
    subject = 'media'
  }
  else if (title.includes('summary')) {
    subject = 'table'
  }
  return `publication.locate-${subject}-${title.includes('320') ? '320' : '1440'}`
}

function a(
  assertion: string,
  destination: AssertionDestination,
  where: string,
  reason?: string,
): AssertionMapping {
  return { assertion, destination, where, ...(reason === undefined ? {} : { reason }) }
}

const conflictPublish = d('publication-conflict.test.tsx', 'a stale publish is refused with the loaded version and shows the conflict')
const conflictUnpublish = d('publication-conflict.test.tsx', 'a stale unpublish is refused with the loaded version and shows the conflict')
const rejectEn = d('publication-rejection.test.tsx', 'publication explains every rejection in en')
const rejectZh = d('publication-rejection.test.tsx', 'publication explains every rejection in zh')
const serverOnly = d('publication-rejection.test.tsx', 'server-only publication reasons render without a locator and take focus')
const reasonsRecovery = d('publication-rejection.test.tsx', 'publication reasons survive a failed autosave and a successful retry')
const cancelConflict = d('publication-schedule.test.tsx', 'cancelling during a cross-tab conflict preserves both drafts')
const cancelAutosave = d('publication-schedule.test.tsx', 'cancelling a schedule preserves a draft rejected by autosave')
const delayedRefresh = d('publication-schedule.test.tsx', 'a delayed schedule refresh cannot restore a cancelled plan or its header badge')
const timezone = d('publication-schedule.test.tsx', 'timezone validation translates errors and ignores outdated failures')
const failedPlan = d('publication-schedule.test.tsx', 'refreshing a failed plan updates the header and translates its rejection code')
const headerConflict = d('publication-header.test.tsx', 'the real header disables publish during a conflict and keeps the scheduled badge')
const headerLive = d('publication-header.test.tsx', 'the real header renders the live link href after publishing')

function rejectionAssertions(width: number, locale: 'en' | 'zh'): AssertionMapping[] {
  const dom = locale === 'en' ? rejectEn : rejectZh
  const old = pw('publication-remaining.spec.ts', `publication explains every rejection at ${width}px in ${locale}`)
  const heading = locale === 'en' ? 'Publication checks failed' : '发布未通过检查'
  return [
    a(`the notice heading is ${heading}`, 'dom', dom),
    a('the five issue descriptions render in document order', 'dom', dom),
    a('neither INVALID_DOCUMENT nor PUBLICATION_INVALID is rendered', 'dom', dom),
    a('exactly one rejection notice and attempt 1 are kept', 'dom', dom),
    a('the publish request carries the saved version, live generation and head revision', 'dom', dom),
    a('the notice stays inside the viewport', 'retained-pw', old, 'withinViewport is layout.'),
    a('the page has no horizontal overflow (document.scrollWidth <= innerWidth)', 'retained-pw', old, 'Global overflow is layout at 1440 and 320.'),
    a('the case screenshots the notice', 'dropped', old, 'PNG is a diagnostic capture, not an assertion.'),
  ]
}

function saveFailureAssertions(code: string): AssertionMapping[] {
  const dom = d('publication-rejection.test.tsx', `publishing retains the save failure reason ${code} and permits correction`)
  return [
    a('the changed title enters the draft through the hook-level metadata change (updateFields + draft.changed)', 'dom', dom, 'The production title update path; native input wiring is not claimed.'),
    a('the refused save shows its reason and no publish is sent', 'dom', dom),
    a('a second publish before correction sends no publish and keeps the reason', 'dom', dom),
    a(`the ${code === 'CONNECTION_FAILED' ? 'offline retry sends a second save' : 'blocked error sends no second save'}`, 'dom', dom),
    a('after correction one save carries the corrected title and one publish carries the saved head', 'dom', dom),
    a('the notice clears and the acknowledgement becomes live', 'dom', dom),
    a('given a livePath, the real header renders the anchor and href', 'dom', headerLive, 'Presentation contract; production useLivePath integration is not mounted.'),
    a('the corrected publish leads to the verified live link', 'retained-pw', pw('publication-remaining.spec.ts', `publishing retains the save failure reason ${code} and permits correction`), 'Production useLivePath integration; the header test supplies livePath.'),
  ]
}

export const publicationRetirements: readonly PublicationCaseRetirement[] = [
  {
    id: 'publication.conflict-publish',
    oldCase: pw('publication-remaining.spec.ts', 'a clean tab resolves a publish conflict before retrying'),
    dom: [conflictPublish],
    assertions: [
      a('the loaded title remains the local document title', 'dom', conflictPublish),
      a('the stale publish carries the loaded version, live generation and head revision', 'dom', conflictPublish),
      a('the 409 keeps the loaded acknowledgement and the conflict state', 'dom', conflictPublish),
      a('the conflict notice replaces the generic error notice', 'dom', conflictPublish),
      a('Compare changes renders the server baseline and the revision diff', 'dom', conflictPublish),
      a('Use server version cannot reopen when persistLocal fails', 'dom', conflictPublish),
      a('Use server version persists the recovery copy then reopens the server document', 'retained-pw', pw('publication-remaining.spec.ts', 'a clean tab resolves a publish conflict before retrying'), 'Pending native adapter; IDB success/reload remains in the old PW case.'),
      a('the header publish control is disabled while conflicted', 'dom', headerConflict),
      a('the local title stays after the conflict', 'dom', conflictPublish),
      a('the retried publish carries the adopted version and head', 'retained-pw', pw('publication-remaining.spec.ts', 'a clean tab resolves a publish conflict before retrying'), 'The adopted session exists only after the real recovery reload; pending native adapter.'),
      a('given a livePath, the real header renders the anchor and href', 'dom', headerLive, 'Presentation contract; production useLivePath integration is not mounted.'),
      a('the retried publish reaches the adopted live state', 'retained-pw', pw('publication-remaining.spec.ts', 'a clean tab resolves a publish conflict before retrying'), 'Adopted session pending native adapter.'),
      a('every request is served', 'dom', conflictPublish, 'The stub teardown fails on an unmatched request.'),
    ],
  },
  {
    id: 'publication.conflict-unpublish',
    oldCase: pw('publication-remaining.spec.ts', 'a clean tab resolves a unpublish conflict before retrying'),
    dom: [conflictUnpublish],
    assertions: [
      a('the loaded title remains the local document title', 'dom', conflictUnpublish),
      a('the stale unpublish carries the loaded version and live generation without a revision id', 'dom', conflictUnpublish),
      a('the 409 keeps the live acknowledgement and the conflict state', 'dom', conflictUnpublish),
      a('the conflict notice replaces the generic error notice', 'dom', conflictUnpublish),
      a('Compare changes renders the server baseline and the revision diff', 'dom', conflictUnpublish),
      a('Use server version cannot reopen when persistLocal fails', 'dom', conflictUnpublish),
      a('Use server version persists the recovery copy then reopens the server document', 'retained-pw', pw('publication-remaining.spec.ts', 'a clean tab resolves a unpublish conflict before retrying'), 'Pending native adapter; IDB success/reload remains in the old PW case.'),
      a('the header publish control is disabled while conflicted', 'dom', headerConflict),
      a('the unpublish menu and confirmation dialog are operated', 'retained-pw', pw('publication-remaining.spec.ts', 'a clean tab resolves a unpublish conflict before retrying'), 'Browser menu/dialog interaction; the request and conflict state are DOM.'),
      a('the local title stays after the conflict', 'dom', conflictUnpublish),
      a('the retried unpublish carries the adopted version', 'retained-pw', pw('publication-remaining.spec.ts', 'a clean tab resolves a unpublish conflict before retrying'), 'Pending native adapter; the adopted session needs the real recovery reload.'),
      a('given a livePath, the real header renders the anchor and href', 'dom', headerLive, 'Presentation contract; production useLivePath integration is not mounted.'),
      a('the live link is gone after unpublish', 'retained-pw', pw('publication-remaining.spec.ts', 'a clean tab resolves a unpublish conflict before retrying'), 'Unpublish clears the live link; adopted-session state pending native adapter.'),
      a('every request is served', 'dom', conflictUnpublish),
    ],
  },
  {
    id: 'publication.rejection-1440-en',
    oldCase: pw('publication-remaining.spec.ts', 'publication explains every rejection at 1440px in en'),
    dom: [rejectEn],
    assertions: rejectionAssertions(1440, 'en'),
  },
  {
    id: 'publication.rejection-1440-zh',
    oldCase: pw('publication-remaining.spec.ts', 'publication explains every rejection at 1440px in zh'),
    dom: [rejectZh],
    assertions: rejectionAssertions(1440, 'zh'),
  },
  {
    id: 'publication.rejection-320-en',
    oldCase: pw('publication-remaining.spec.ts', 'publication explains every rejection at 320px in en'),
    dom: [rejectEn],
    assertions: rejectionAssertions(320, 'en'),
  },
  {
    id: 'publication.rejection-320-zh',
    oldCase: pw('publication-remaining.spec.ts', 'publication explains every rejection at 320px in zh'),
    dom: [rejectZh],
    assertions: rejectionAssertions(320, 'zh'),
  },
  ...[
    { width: 1440, title: 'publication rejection is revealed from the end of a long document at 1440px' },
    { width: 320, title: 'publication rejection is revealed from the end of a long document at 320px' },
  ].map(({ width, title }) => ({
    id: `publication.rejection-long-${width}`,
    oldCase: pw('publication-remaining.spec.ts', title),
    dom: [],
    assertions: [
      a('the editor scrolls past 1000px before publishing', 'retained-pw', pw('publication-remaining.spec.ts', title), 'Real document scroll geometry.'),
      a('the notice is in the viewport', 'retained-pw', pw('publication-remaining.spec.ts', title), 'Viewport geometry.'),
      a('the notice takes focus', 'retained-pw', pw('publication-remaining.spec.ts', title), 'Focus after a real publish in BlockNote.'),
      a('the notice top is below the sticky header', 'retained-pw', pw('publication-remaining.spec.ts', title), 'Sticky header layout.'),
      a('a second publish reveals the same notice again', 'retained-pw', pw('publication-remaining.spec.ts', title), 'Repeated reveal on a real document.'),
    ],
  })),
  ...[
    'DOCUMENT_TOO_LARGE',
    'INVALID_DOCUMENT',
    'CONNECTION_FAILED',
  ].map(code => ({
    id: `publication.save-failure-${code.toLowerCase()}`,
    oldCase: pw('publication-remaining.spec.ts', `publishing retains the save failure reason ${code} and permits correction`),
    dom: [
      d('publication-rejection.test.tsx', `publishing retains the save failure reason ${code} and permits correction`),
    ],
    assertions: saveFailureAssertions(code),
  })),
  {
    id: 'publication.server-only-reason',
    oldCase: pw('editor-locate.spec.ts', 'server-only publication reasons remain visible without a matching local block'),
    dom: [serverOnly],
    assertions: [
      a('a refusal issue with no local block renders its description', 'dom', serverOnly),
      a('the notice takes focus on the real notice element', 'dom', serverOnly),
      a('no locator button is offered for a missing block', 'dom', serverOnly),
    ],
  },
  {
    id: 'publication.reasons-through-autosave',
    oldCase: pw('editor-locate.spec.ts', 'failed autosave retains publication reasons and typing focus at 1440px'),
    dom: [reasonsRecovery],
    assertions: [
      a('a prior PUBLICATION_INVALID rejection keeps its reasons', 'dom', reasonsRecovery),
      a('a content transaction alone increments coordinator.editSeq through onChange->changed', 'dom', reasonsRecovery),
      a('a failed 503 autosave shows the generic error beside the publication reasons', 'dom', reasonsRecovery),
      a('the next autosave succeeds and clears only the generic error', 'dom', reasonsRecovery),
      a('the prior publication reasons remain after recovery', 'dom', reasonsRecovery),
      a('typing focus stays in the title field', 'retained-pw', pw('editor-locate.spec.ts', 'failed autosave retains publication reasons and typing focus at 1440px'), 'Real BlockNote/title focus continuity.'),
      a('the metadata change recomputes the local issue list and keeps the two-table locator', 'dom', reasonsRecovery),
      a('the locator for the two table issues is visible after recovery', 'dom', reasonsRecovery),
    ],
  },
  {
    id: 'publication.reasons-through-autosave-320',
    oldCase: pw('editor-locate.spec.ts', 'failed autosave retains publication reasons and typing focus at 320px'),
    dom: [reasonsRecovery],
    assertions: [
      a('the prior reasons and the 503/success autosave states are the same', 'dom', reasonsRecovery),
      a('title typing focus stays at the narrow layout', 'retained-pw', pw('editor-locate.spec.ts', 'failed autosave retains publication reasons and typing focus at 320px'), 'Native focus and layout.'),
      a('the two-table locator remains visible after recovery', 'dom', reasonsRecovery, 'Shared DOM case; 320px geometry is not claimed.'),
    ],
  },
  {
    id: 'publication.schedule-cancel-conflict',
    oldCase: pw('publication-remaining-schedule.spec.ts', 'cancelling during a cross-tab conflict preserves both drafts'),
    dom: [cancelConflict],
    assertions: [
      a('the pending badge is shown', 'dom', cancelConflict, 'The real ScheduledStatus component, not the header slot.'),
      a('the production title path marks the draft dirty and the 2s autosave conflicts', 'dom', cancelConflict),
      a('the schedule settings are mounted open', 'dom', cancelConflict),
      a('the publication tab and scheduled-publication section are opened', 'retained-pw', pw('publication-remaining-schedule.spec.ts', 'cancelling during a cross-tab conflict preserves both drafts'), 'The DOM mounts the production ScheduleSettings open; the tab/section click remains.'),
      a('cancelling clears the pending plan', 'dom', cancelConflict),
      a('the Cancel schedule control count is 0', 'dom', cancelConflict),
      a('the scheduled badge is gone', 'dom', cancelConflict),
      a('the conflict status and local title survive the metadata write', 'dom', cancelConflict),
      a('the server title and head are not backdated', 'dom', cancelConflict),
      a('the DELETE carries the plan id and the latest expected version', 'dom', cancelConflict),
      a('the header badge slot clears', 'retained-pw', pw('publication-remaining-schedule.spec.ts', 'cancelling during a cross-tab conflict preserves both drafts'), 'The badge is proved at component level; its header slot needs EditorHeader.'),
    ],
  },
  {
    id: 'publication.schedule-cancel-failed-1440',
    oldCase: pw('publication-remaining-schedule.spec.ts', 'cancelling a schedule preserves a draft rejected by autosave at 1440px'),
    dom: [cancelAutosave],
    assertions: [
      a('the publication tab and scheduled-publication section are opened', 'retained-pw', pw('publication-remaining-schedule.spec.ts', 'cancelling a schedule preserves a draft rejected by autosave at 1440px'), 'The DOM mounts ScheduleSettings open; the tab/section click remains.'),
      a('the pending header badge is shown before cancel', 'dom', headerConflict),
      a('the header badge is gone after cancel', 'retained-pw', pw('publication-remaining-schedule.spec.ts', 'cancelling a schedule preserves a draft rejected by autosave at 1440px'), 'Header badge slot.'),
      a('closing settings returns to the editor', 'retained-pw', pw('publication-remaining-schedule.spec.ts', 'cancelling a schedule preserves a draft rejected by autosave at 1440px'), 'closeSettings wiring; no drawer at 1440.'),
      a('the refused 2s autosave shows its validation reason', 'dom', cancelAutosave),
      a('cancelling clears the plan and badge without a save', 'dom', cancelAutosave),
      a('the Cancel schedule control count is 0', 'dom', cancelAutosave),
      a('the unsaved title is preserved', 'dom', cancelAutosave),
      a('the corrected autosave carries the preserved title', 'dom', cancelAutosave),
      a('the error notice clears after the successful save', 'dom', cancelAutosave),
    ],
  },
  {
    id: 'publication.schedule-cancel-failed-390',
    oldCase: pw('publication-remaining-schedule.spec.ts', 'cancelling a schedule preserves a draft rejected by autosave at 390px'),
    dom: [cancelAutosave],
    assertions: [
      a('the refused autosave, cancel, preserved title and corrected save states', 'dom', cancelAutosave),
      a('the 390px settings drawer opens, cancels and closes back to the title', 'retained-pw', pw('publication-remaining-schedule.spec.ts', 'cancelling a schedule preserves a draft rejected by autosave at 390px'), 'Narrow mobile drawer wiring only; no business flow retained.'),
    ],
  },
  {
    id: 'publication.schedule-refresh-race',
    oldCase: pw('publication-remaining-schedule.spec.ts', 'a delayed schedule refresh cannot restore a cancelled plan or its header badge'),
    dom: [delayedRefresh],
    assertions: [
      a('the publication tab and scheduled-publication section are opened', 'retained-pw', pw('publication-remaining-schedule.spec.ts', 'a delayed schedule refresh cannot restore a cancelled plan or its header badge'), 'The DOM mounts ScheduleSettings open; the tab/section click remains.'),
      a('a held list reply captured before cancel is ignored when delivered later', 'dom', delayedRefresh),
      a('the cancelled plan remains cancelled', 'dom', delayedRefresh),
      a('Load schedules is enabled again', 'dom', delayedRefresh),
      a('the Cancel schedule control count is 0', 'dom', delayedRefresh),
      a('the scheduled badge component is gone', 'dom', delayedRefresh),
      a('the header badge slot stays clear', 'retained-pw', pw('publication-remaining-schedule.spec.ts', 'a delayed schedule refresh cannot restore a cancelled plan or its header badge'), 'Header slot.'),
      a('the held and cancelled list requests are fully served', 'dom', delayedRefresh),
    ],
  },
  {
    id: 'publication.schedule-timezone-validation',
    oldCase: pw('publication-remaining-schedule.spec.ts', 'timezone validation explains errors locally and ignores outdated failures'),
    dom: [timezone],
    assertions: [
      a('the publication tab and scheduled-publication section are opened', 'retained-pw', pw('publication-remaining-schedule.spec.ts', 'timezone validation explains errors locally and ignores outdated failures'), 'The DOM mounts ScheduleSettings open; the tab/section click remains.'),
      a('the device timezone is the initial value', 'dom', timezone),
      a('searching an unknown zone shows the local empty state without a schedule-time request', 'dom', timezone),
      a('Use device timezone restores the device zone', 'dom', timezone),
      a('UTC and Asia/Tokyo are selected by keyboard', 'dom', timezone),
      a('the Check timezone and DST control sends the request', 'dom', timezone),
      a('TIMEZONE_INVALID is translated in the form status', 'dom', timezone),
      a('a held stale failure from the previous zone is ignored', 'dom', timezone),
      a('fresh choices enable the schedule action after a verified choice', 'dom', timezone),
      a('the publication date and time inputs set the local time', 'retained-pw', pw('publication-remaining-schedule.spec.ts', 'timezone validation explains errors locally and ignores outdated failures'), 'The DOM sets localTime directly; the date/time input wiring remains.'),
      a('the screenshot is captured', 'dropped', pw('publication-remaining-schedule.spec.ts', 'timezone validation explains errors locally and ignores outdated failures'), 'Diagnostic capture, not an assertion.'),
    ],
  },
  {
    id: 'publication.schedule-failed-plan',
    oldCase: pw('publication-remaining-schedule.spec.ts', 'refreshing a failed plan updates the header and translates its rejection code'),
    dom: [failedPlan],
    assertions: [
      a('a pending badge is shown initially', 'dom', failedPlan),
      a('the publication tab and scheduled-publication section are opened', 'retained-pw', pw('publication-remaining-schedule.spec.ts', 'refreshing a failed plan updates the header and translates its rejection code'), 'The DOM mounts ScheduleSettings open; the tab/section click remains.'),
      a('the Load schedules control refreshes the plan', 'dom', failedPlan),
      a('PUBLICATION_CONFLICT is translated in the schedule error', 'dom', failedPlan),
      a('the failed plan replaces the pending badge', 'dom', failedPlan),
      a('the header badge slot no longer claims a pending schedule', 'retained-pw', pw('publication-remaining-schedule.spec.ts', 'refreshing a failed plan updates the header and translates its rejection code'), 'Header slot.'),
      a('the case screenshots the job error', 'dropped', pw('publication-remaining-schedule.spec.ts', 'refreshing a failed plan updates the header and translates its rejection code'), 'Diagnostic capture, not an assertion.'),
    ],
  },
  {
    id: 'publication.schedule-failed-plan-zh',
    oldCase: pw('publication-remaining-schedule.spec.ts', 'failed schedule explanations fit the Chinese mobile drawer'),
    dom: [],
    assertions: [
      a('the Chinese schedule error text renders', 'retained-pw', pw('publication-remaining-schedule.spec.ts', 'failed schedule explanations fit the Chinese mobile drawer'), 'The DOM failed-plan case is English; no zh replacement in this batch.'),
      a('the Chinese failed plan fits the 390px drawer without horizontal overflow', 'retained-pw', pw('publication-remaining-schedule.spec.ts', 'failed schedule explanations fit the Chinese mobile drawer'), 'Mobile layout.'),
      a('the case screenshots the failed drawer', 'dropped', pw('publication-remaining-schedule.spec.ts', 'failed schedule explanations fit the Chinese mobile drawer'), 'Diagnostic capture, not an assertion.'),
    ],
  },
  {
    id: 'publication.preflight-live',
    oldCase: pw('editor-preflight.spec.ts', 'publication preflight updates when diagram source and empty media change'),
    dom: [],
    assertions: [
      a('the issue derivation and list order rules', 'unit', 'tests/unit/editor-publication.test.ts', 'Pure publication node requirements already own this rule.'),
      a('editing diagram source clears and restores the reason through a real transaction', 'retained-pw', pw('editor-preflight.spec.ts', 'publication preflight updates when diagram source and empty media change'), 'Real BlockNote contenteditable transaction and incremental node index.'),
      a('deleting the empty media block through the block menu clears the issue', 'retained-pw', pw('editor-preflight.spec.ts', 'publication preflight updates when diagram source and empty media change'), 'Real block menu interaction.'),
    ],
  },
  ...[
    'publication locates nested media and its diagram editing control at 1440px',
    'publication locates nested media and its diagram editing control at 320px',
    'publication summary cycles current table order and returns focus at 1440px',
    'publication summary cycles current table order and returns focus at 320px',
    'publication target counts follow block deletion and undo at 1440px',
    'publication target counts follow block deletion and undo at 320px',
  ].map(title => ({
    id: locateId(title),
    oldCase: pw('editor-locate.spec.ts', title),
    dom: [],
    assertions: [
      a('the locator selects the real ProseMirror block/cursor', 'retained-pw', pw('editor-locate.spec.ts', title), 'Real BlockNote selection.'),
      a('the target scrolls into view below the toolbar/sticky header', 'retained-pw', pw('editor-locate.spec.ts', title), 'Geometry.'),
      a('focus/selection.anchorNode lands on the intended control', 'retained-pw', pw('editor-locate.spec.ts', title), 'Native focus/selection.'),
      a('deletion/undo and current document order are driven through the editor', 'retained-pw', pw('editor-locate.spec.ts', title), 'Real editor undo/transaction order.'),
    ],
  })),
  {
    id: 'publication.timezone-picker',
    oldCase: pw('editor-workspace.spec.ts', 'publication timezone is automatic and searchable in en at 1440px'),
    dom: [timezone],
    assertions: [
      a('the publication tab and scheduled-publication section are opened', 'retained-pw', pw('editor-workspace.spec.ts', 'publication timezone is automatic and searchable in en at 1440px'), 'The DOM mounts ScheduleSettings open; the tab/section click remains.'),
      a('the browser timezone fixture is Asia/Taipei', 'retained-pw', pw('editor-workspace.spec.ts', 'publication timezone is automatic and searchable in en at 1440px'), 'Component browser timezoneId; the DOM uses the host zone.'),
      a('the device zone is the initial value', 'dom', timezone),
      a('searching and clearing the picker changes the selected zone locally', 'dom', timezone),
      a('London search', 'retained-pw', pw('editor-workspace.spec.ts', 'publication timezone is automatic and searchable in en at 1440px'), 'The DOM case selects UTC and Asia/Tokyo; London remains in the old case.'),
      a('no non-GET/HEAD write is sent while only the picker changes', 'dom', timezone),
      a('keyboard selection of UTC and Asia/Tokyo', 'dom', timezone),
      a('viewport containment, popover opacity and Axe', 'retained-pw', pw('editor-workspace.spec.ts', 'publication timezone is automatic and searchable in en at 1440px'), 'Layout/CSS/Axe.'),
      a('native focus and screenshot', 'retained-pw', pw('editor-workspace.spec.ts', 'publication timezone is automatic and searchable in en at 1440px'), 'Native focus/PNG is diagnostic.'),
    ],
  },
  {
    id: 'publication.timezone-picker-zh',
    oldCase: pw('editor-workspace.spec.ts', 'publication timezone is automatic and searchable in zh at 390px'),
    dom: [],
    assertions: [
      a('the editor entry loads the session title and body', 'retained-pw', pw('editor-workspace.spec.ts', 'publication timezone is automatic and searchable in zh at 390px'), 'Real editor entry load.'),
      a('the browser timezone fixture is Asia/Taipei', 'retained-pw', pw('editor-workspace.spec.ts', 'publication timezone is automatic and searchable in zh at 390px'), 'Component browser timezoneId; the DOM uses the host zone.'),
      a('device default, clear and UTC/Asia/Tokyo keyboard', 'dom', timezone, 'The shared DOM timezone case is locale-independent; it is not claimed as the zh UI.'),
      a('London search', 'retained-pw', pw('editor-workspace.spec.ts', 'publication timezone is automatic and searchable in zh at 390px'), 'The DOM case selects UTC and Asia/Tokyo; London remains in the old case.'),
      a('no non-GET/HEAD write is sent while only the picker changes', 'dom', timezone, 'Shared locale-independent rule.'),
      a('the Chinese drawer opens the timezone picker', 'retained-pw', pw('editor-workspace.spec.ts', 'publication timezone is automatic and searchable in zh at 390px'), 'Chinese drawer wiring/layout.'),
      a('the picker viewport containment, opacity and Axe in Chinese at 390px', 'retained-pw', pw('editor-workspace.spec.ts', 'publication timezone is automatic and searchable in zh at 390px'), 'Layout/CSS/Axe.'),
      a('the screenshot is captured', 'dropped', pw('editor-workspace.spec.ts', 'publication timezone is automatic and searchable in zh at 390px'), 'Diagnostic capture, not an assertion.'),
    ],
  },
]
