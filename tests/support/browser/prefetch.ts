import type { Page, Request } from '@playwright/test'

const PREFETCH = 'next-router-prefetch'

// Before a document is unloaded the shell still has its own route prefetches in
// flight. The framework rejects those prefetch promises when the unload cancels them
// and surfaces the rejection as an uncaught error, so this fixture waits for the batch
// the page started to settle - finished or failed - before the next navigation, instead
// of waiting for the whole page to fall quiet. Nothing is cached or replayed, no
// response is touched, and no page error is filtered: the wait only covers work the app
// itself already started, while business readiness stays independent of it.
async function paint(page: Page): Promise<void> {
  // Two frames let React commit whatever the settled responses unblocked before the
  // batch is considered closed.
  await page.evaluate(async () => await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
}

function settlePrefetches(page: Page, pending: Map<Request, Promise<void>>):
(options?: { deadlineMs?: number }) => Promise<'settled' | 'deadline'> {
  return async ({ deadlineMs = 2000 } = {}) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<'deadline'>((resolve) => {
      timer = setTimeout(resolve, deadlineMs, 'deadline')
    })
    try {
      for (;;) {
        const outstanding = [
          ...pending.values(),
        ]
        if (outstanding.length === 0) {
          const painted = paint(page).then(() => 'settled' as const)
          if (await Promise.race([painted, deadline]) === 'deadline') {
            return 'deadline'
          }
          if (pending.size === 0) {
            return 'settled'
          }
          continue
        }
        const batch = Promise.all(outstanding).then(() => 'settled' as const)
        const outcome = await Promise.race([batch, deadline])
        if (outcome === 'deadline') {
          return 'deadline'
        }
      }
    }
    finally {
      clearTimeout(timer)
    }
  }
}

export function trackPrefetchBatches(page: Page): {
  settle: (options?: { deadlineMs?: number }) => Promise<'settled' | 'deadline'>
  observed: () => number
} {
  const pending = new Map<Request, Promise<void>>()
  const release = new Map<Request, () => void>()
  let observed = 0
  const settled = (request: Request): void => {
    release.get(request)?.()
    release.delete(request)
    pending.delete(request)
  }
  const clear = (): void => {
    for (const done of release.values()) {
      done()
    }
    pending.clear()
    release.clear()
  }
  page.on('request', (request) => {
    if (request.headers()[PREFETCH] !== '1' || pending.has(request)) {
      return
    }
    observed++
    pending.set(request, new Promise<void>((resolve) => {
      release.set(request, resolve)
    }))
  })
  page.on('requestfinished', settled)
  page.on('requestfailed', settled)
  // A request cannot outlive the document that started it, so a navigation drops what
  // the old document left behind instead of waiting on it forever.
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      clear()
    }
  })
  page.once('close', clear)
  return { settle: settlePrefetches(page, pending), observed: () => observed }
}
