import type { Page, Route } from '@playwright/test'
import type { Buffer } from 'node:buffer'

export type HeldMethod = 'GET' | 'POST' | 'PUT'

/** Bytes captured as soon as the server replied, never the live `APIResponse`. */
export type HeldAnswer = {
  readonly status: number
  readonly headers: Record<string, string>
  readonly body: Buffer
}

export type HeldRequest = {
  /** Resolves once a matching request reached the server and waits for `release`. */
  readonly captured: Promise<void>
  /** Requests the hold captured before it was released; later traffic passes untouched. */
  readonly observed: () => number
  /** Answers captured so far, in arrival order, readable while the request is held. */
  readonly answers: () => readonly HeldAnswer[]
  /** Answers the captured requests and stops intercepting; reports a failed answer. */
  readonly release: () => Promise<void>
  /** Idempotent, never-throwing form of `release()` for `finally` blocks. */
  readonly dispose: () => Promise<void>
}

type Deferred = { readonly promise: Promise<void>, readonly resolve: () => void }

function deferred(): Deferred {
  let resolve: () => void = () => {}
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

async function materialize(route: Route): Promise<HeldAnswer> {
  const response = await route.fetch()
  return {
    status: response.status(),
    headers: response.headers(),
    body: await response.body(),
  }
}

/**
 * Holds the matching requests of one method until the test answers them, keeping the
 * surface in its in-flight state while the test arranges the next interaction.
 *
 * Each request is answered from bytes captured as soon as the server replied: the page
 * fixture disposes live responses when it tears the context down, so a held answer must
 * not depend on one still being readable. `release()` delivers those answers before the
 * body continues, so no handler is left answering while teardown closes the page, and it
 * reports a failed answer instead of hiding it. `dispose()` drains the same resources in
 * `finally` without throwing, so a failing body keeps its own error.
 */
export async function holdRequest(
  page: Page,
  url: string,
  method: HeldMethod,
): Promise<HeldRequest> {
  const pattern = `**${url}`
  const captured = deferred()
  const held = deferred()
  const answers: HeldAnswer[] = []
  const running: Promise<void>[] = []
  const failures: Error[] = []
  let released = false
  let seen = 0
  const answer = async (route: Route): Promise<void> => {
    const materialized = await materialize(route)
    answers.push(materialized)
    captured.resolve()
    await held.promise
    await route.fulfill(materialized)
  }
  const handler = async (route: Route): Promise<void> => {
    if (released || route.request().method() !== method) {
      await route.continue()
      return
    }
    seen++
    const attempt = answer(route)
    running.push(attempt)
    // Recording the answer here keeps a failure reportable by `release()` instead of an
    // unhandled rejection, and lets the body continue rather than wait for an answer.
    await attempt.catch((failure: unknown) => {
      failures.push(failure instanceof Error
        ? failure
        : new Error('The held request could not be answered.', { cause: failure }))
      captured.resolve()
    })
  }
  await page.route(pattern, handler)
  // A pending route must be answered before interception ends: removing the pattern
  // releases whatever the browser still pauses, and a later answer would find its route
  // handled already. Traffic after the release passes untouched either way.
  const drain = async (): Promise<void> => {
    released = true
    held.resolve()
    await Promise.allSettled(running)
    // A closed page cannot unroute anymore; teardown is not the failure under test.
    await page.unroute(pattern, handler).catch(() => {})
  }
  return {
    captured: captured.promise,
    observed: () => seen,
    answers: () => answers,
    release: async () => {
      await drain()
      const failure = failures[0]
      if (failure !== undefined) {
        throw failure
      }
    },
    dispose: drain,
  }
}
