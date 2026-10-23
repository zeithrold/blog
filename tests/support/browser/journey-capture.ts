import type { Page, TestInfo } from '@playwright/test'

export type CaptureProof = {
  page: string
  url: string
  from: number
  until: number
  count: number
  remaining: number
  policies: number
}

// WebKit screenshot preparation inserts a literal unnonced `body {}` into every frame.
// Record that exact removed style node, rather than exempting arbitrary CSP failures.
export async function captureEvidence(
  page: Page,
  info: TestInfo,
  options: { name: string, pageId: string, proofs: CaptureProof[] },
): Promise<void> {
  const key = `journey-screenshot-${crypto.randomUUID()}`
  const frames = page.frames()
  for (const frame of frames) {
    await frame.evaluate((storageKey) => {
      const state = { count: 0, observer: new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node instanceof HTMLStyleElement && node.nonce === '' && node.textContent === 'body {}') {
              state.count++
            }
          }
        }
      }) }
      state.observer.observe(document, { childList: true, subtree: true })
      Reflect.set(window, storageKey, state)
    }, key)
  }
  const from = Date.now()
  try {
    await info.attach(options.name, {
      body: await page.screenshot({ animations: 'allow', caret: 'initial' }),
      contentType: 'image/png',
    })
  }
  finally {
    for (const frame of frames) {
      const observed = await frame.evaluate((storageKey) => {
        const state: unknown = Reflect.get(window, storageKey)
        if (state === null || typeof state !== 'object') {
          return { count: 0, policies: 1 }
        }
        const observer: unknown = Reflect.get(state, 'observer')
        if (observer instanceof MutationObserver) {
          observer.disconnect()
        }
        const count: unknown = Reflect.get(state, 'count')
        Reflect.deleteProperty(window, storageKey)
        const policies = 1 + document.querySelectorAll('meta[http-equiv="Content-Security-Policy" i]').length
        return { count: typeof count === 'number' ? count : 0, policies }
      }, key)
      options.proofs.push({
        page: options.pageId,
        url: frame.url(),
        from,
        until: Date.now(),
        count: observed.count,
        policies: observed.policies,
        remaining: observed.count * observed.policies,
      })
    }
  }
}

export function consumeScreenshotError(
  error: { page: string, url: string, at: number, message: string },
  proofs: CaptureProof[],
): boolean {
  const message = 'Refused to apply a stylesheet because its hash, its nonce, or \'unsafe-inline\' '
    + 'does not appear in the style-src directive of the Content Security Policy.'
  if (error.message !== message) {
    return false
  }
  const proof = proofs.find(item => item.page === error.page && item.url === error.url
    && item.from <= error.at && error.at <= item.until && item.remaining > 0)
  if (proof === undefined) {
    return false
  }
  proof.remaining--
  return true
}
