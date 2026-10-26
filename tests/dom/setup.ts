import { afterEach } from 'vitest'
import { outstandingFetchProblems, resetFetchBoundary } from './http'

/*
 * React requires this flag before any `act` scope outside a Jest-like runner.
 * Vitest supplies the jsdom document; the flag is the only DOM harness setup the
 * pilot needs, so no global test framework is enabled.
 */
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

/*
 * The fetch boundary belongs to the layer, not to a case's last line.
 *
 * A request no case declared, a handler that threw, a request that never settled
 * and a table a case left installed all fail the case that produced them: a case
 * cannot pass by never reaching its own `expectServed()`, and it cannot leak a
 * stubbed `fetch` into the next one. Teardown drains what is still in flight
 * under a real-time bound, reports, and only then restores and forgets.
 */
afterEach(async () => {
  const problems = await outstandingFetchProblems()
  resetFetchBoundary()
  if (problems.length > 0) {
    throw new Error(`The DOM layer's fetch boundary was left open: ${problems.join('; ')}`)
  }
})
