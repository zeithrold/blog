import { afterEach, expect, it } from 'vitest'
import { departureCase, resetDeparture, savingCopy, stayCopy } from './history-departure-policy-support'

/**
 * The editor's departure policy as the reader meets it: the saving dialog over
 * the real source and controller, a real `DraftCoordinator`, a real upload
 * boundary and the host router the editor navigates with.
 *
 * Each case dispatches one real event — the guard `EditorNavigation` registers,
 * called with the reader's target, which is what the shell's in-app navigation
 * asks — and then acts only through the product's own controls: the dialog's
 * "Stay here", the server's eventual acknowledgement of a held save, and a
 * completed upload. No case calls a source callback or cancels a chain by hand.
 *
 * What counts as "left" here is the editor's own call: the host router's `push`,
 * spied for the case's lifetime and left to call through, with the exact target
 * a departure carries. What a browser alone can deliver is not claimed:
 * `next/link`'s `onNavigate` interception, native back, focus hand-back, and the
 * route itself (jsdom implements no document navigation). Those stay with the
 * Playwright cases.
 */

const target = '/admin/documents/newer'

afterEach(resetDeparture)

it('asks an editor with unsaved work before it leaves, and stays when the reader stays', async () => {
  const departure = departureCase()
  departure.edit()
  await departure.leave(target)
  // The held save is what the dialog reports, not a blank spinner.
  expect(departure.busy()).toBe('true')
  expect(departure.phrase()).toContain(savingCopy)
  expect(departure.saves()).toBe(1)
  // The dialog's own control, clicked: the refusal is the product's, not a
  // callback the case chose to cancel.
  await departure.press(stayCopy)
  expect(departure.dialog()).toBeNull()
  expect(departure.departures()).toEqual([])
  // The save the departure held still lands; a cancelled departure leaves no
  // dialog, no recovery copy, no unsaved work and no navigation behind.
  await departure.acknowledge()
  expect(departure.dirty()).toBe(false)
  expect(departure.dialog()).toBeNull()
  expect(departure.departures()).toEqual([])
  expect(departure.recoveries()).toBe(0)
  // With nothing held any more, the next departure is an idle one: the policy
  // was not left latched by the refusal, and it hands over one call, once, with
  // the target the reader chose. No second packet is sent.
  await departure.leave(target)
  expect(departure.dialog()).toBeNull()
  expect(departure.departures()).toEqual([target])
  expect(departure.saves()).toBe(1)
})

it('asks an editor that is still uploading, and hands nothing over when the reader stays', async () => {
  const departure = departureCase()
  departure.upload()
  await departure.leave(target)
  expect(departure.phrase()).toContain(savingCopy)
  // The policy waits for the upload instead of saving a half-inserted document.
  expect(departure.saves()).toBe(0)
  await departure.press(stayCopy)
  expect(departure.dialog()).toBeNull()
  expect(departure.departures()).toEqual([])
  // The policy's wait is still polling when the reader stays; crossing its 40ms
  // interval resumes that continuation rather than ending the case before it
  // runs.
  expect(departure.pendingTimers()).toBeGreaterThan(0)
  await departure.finishUpload()
  expect(departure.pendingTimers()).toBe(0)
  // The resumed wait finds a refusal: no dialog comes back, no packet is sent
  // and nothing is handed to the router after the upload completes.
  expect(departure.dialog()).toBeNull()
  expect(departure.saves()).toBe(0)
  expect(departure.departures()).toEqual([])
  expect(departure.recoveries()).toBe(0)
})

it('lets an idle editor leave without a dialog or a packet', async () => {
  const departure = departureCase()
  await departure.leave(target)
  // Nothing asks and nothing is saved on the way out: the editor hands the host
  // router exactly one call, with the reader's target.
  expect(departure.dialog()).toBeNull()
  expect(departure.saves()).toBe(0)
  expect(departure.departures()).toEqual([target])
  expect(departure.recoveries()).toBe(0)
})
