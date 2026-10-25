import type { Page, Route } from '@playwright/test'
import { expect } from '@playwright/test'
import { catalogItemSchema } from '@/contracts/catalog'
import { sessionSchema } from '@/contracts/session'

export type Kind = 'tag' | 'series'
export type Entry = ReturnType<typeof catalogItemSchema.parse>

export type HeldCatalogRequest = {
  /** Resolves once a matching request reached the server and waits for `release`. */
  readonly captured: Promise<void>
  /** Requests the hold captured before it was released; later traffic passes untouched. */
  readonly observed: () => number
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

/**
 * Holds the matching catalog requests of one method until the test answers them, keeping
 * the surface in its in-flight state while the test arranges the next interaction.
 *
 * Each request is answered from bytes captured as soon as the server replied: the page
 * fixture disposes live responses when it tears the context down, so a held answer must
 * not depend on one still being readable. `release()` delivers those answers before the
 * body continues, so no handler is left answering while teardown closes the page, and it
 * reports a failed answer instead of hiding it. `dispose()` drains the same resources in
 * `finally` without throwing, so a failing body keeps its own error.
 */
export async function holdCatalogRequest(
  page: Page,
  url: string,
  method: 'GET' | 'PUT',
): Promise<HeldCatalogRequest> {
  const pattern = `**${url}`
  const captured = deferred()
  const held = deferred()
  const answers: Promise<void>[] = []
  const failures: Error[] = []
  let released = false
  let seen = 0
  const answer = async (route: Route): Promise<void> => {
    const response = await route.fetch()
    const materialized = {
      status: response.status(),
      headers: response.headers(),
      body: await response.body(),
    }
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
    const running = answer(route)
    answers.push(running)
    // Recording the answer here keeps a failure reportable by `release()` instead of an
    // unhandled rejection the runner would attribute to an unrelated step, and lets the
    // body continue instead of waiting for an answer that will never arrive.
    await running.catch((failure: unknown) => {
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
    await Promise.allSettled(answers)
    await page.unroute(pattern, handler)
  }
  return {
    captured: captured.promise,
    observed: () => seen,
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

export async function writeCatalog(page: Page, kind: Kind, input: {
  name: string
  slug: string
  retired?: boolean
  expectedVersion?: number
}, id?: string): Promise<Entry> {
  const session = sessionSchema.parse(await (await page.request.get('/api/admin/session')).json())
  const response = await page.request.fetch(`/api/admin/catalog/${kind}${id === undefined ? '' : `/${id}`}`, {
    method: id === undefined ? 'POST' : 'PUT',
    data: input,
    headers: {
      'origin': new URL(page.url()).origin,
      'x-csrf-token': session.csrfToken,
      'idempotency-key': crypto.randomUUID(),
    },
  })
  expect(response.ok(), await response.text()).toBe(true)
  return catalogItemSchema.parse(await response.json())
}

export async function fixture(page: Page, kind: Kind): Promise<{ first: Entry, second: Entry, path: string }> {
  await page.goto('/__fixture/login')
  const unique = crypto.randomUUID()
  const first = await writeCatalog(page, kind, { name: `Boundary A ${unique}`, slug: `boundary-a-${unique}` })
  const second = await writeCatalog(page, kind, { name: `Boundary B ${unique}`, slug: `boundary-b-${unique}` })
  await page.goto(`/admin/${kind === 'tag' ? 'tags' : 'series'}`)
  await expect(page.getByRole('button', { name: `Edit ${first.name}`, exact: true })).toBeVisible()
  return { first, second, path: `/api/admin/catalog/${kind}` }
}
