import type { Locator, Page } from '@playwright/test'
import type { JourneyContext } from '~/tests/support/browser/journey'
import { dragBlock } from '~/tests/browser/editor/blocks/block-action-helpers'

declare global {
  // eslint-disable-next-line ts/consistent-type-definitions -- Window augmentation requires declaration merging.
  interface Window {
    __blogJourneyDragMedia?: {
      original: (this: Node, deep?: boolean) => Node
      resources: { url: string, at: number, source: HTMLMediaElement, clone: HTMLMediaElement }[]
    }
  }
}

export async function dragWithMediaEvidence(
  page: Page,
  journey: JourneyContext['journey'],
  handle: Locator,
  target: Locator,
): Promise<void> {
  const from = Date.now()
  await page.evaluate(() => {
    if (window.__blogJourneyDragMedia !== undefined) {
      throw new Error('A drag observation is already active')
    }
    // eslint-disable-next-line ts/unbound-method -- Invoked with the original node as its receiver below.
    const original = Node.prototype.cloneNode
    const resources: { url: string, at: number, source: HTMLMediaElement, clone: HTMLMediaElement }[] = []
    window.__blogJourneyDragMedia = { original, resources }
    // BlockNote clones the entire group before pruning unselected blocks. WebKit can
    // start media loads even in that detached clone; observe without changing its DOM.
    Node.prototype.cloneNode = function (this: Node, deep?: boolean): Node {
      const cloned = original.call(this, deep)
      if (this instanceof Element && cloned instanceof Element && this.classList.contains('bn-block-group')
        && this.closest('.bn-editor') !== null) {
        const sources = Array.from(this.querySelectorAll<HTMLMediaElement>('audio[src], video[src]'))
        for (const [index, clone] of cloned.querySelectorAll<HTMLMediaElement>('audio[src], video[src]').entries()) {
          const source = sources[index]
          if (source !== undefined) {
            resources.push({ url: clone.src, at: Date.now(), source, clone })
          }
        }
      }
      return cloned
    }
  })
  try {
    await dragBlock(page, handle, target)
  }
  finally {
    const resources = await page.evaluate(() => {
      const state = window.__blogJourneyDragMedia
      if (state === undefined) {
        throw new Error('Missing drag observation')
      }
      Node.prototype.cloneNode = state.original
      delete window.__blogJourneyDragMedia
      return state.resources.map(item => ({
        url: item.url,
        at: item.at,
        detached: !item.clone.isConnected,
        sourceConnected: item.source.isConnected,
        sourceError: item.source.error?.code ?? null,
        remaining: 1,
      }))
    })
    journey.drags.push({ page: journey.pageIds.get(page) ?? '', from, until: Date.now(), resources })
  }
}
