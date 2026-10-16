import type { Page } from '@playwright/test'

type Probe = {
  source: number
  armed: boolean
  second: boolean
  holding: boolean
  pops: number[]
  repairs: { from: number, delta: number }[]
  pending: (() => void)[]
  release: () => void
}

declare global {
  // eslint-disable-next-line ts/consistent-type-definitions -- Window requires interface augmentation.
  interface Window {
    historyProbe: Probe
  }
}

export async function interleavingProbe(page: Page): Promise<void> {
  await page.addInitScript(installProbe)
}

// eslint-disable-next-line max-lines-per-function -- Playwright serializes this initializer without module imports.
function installProbe(): void {
  const probe: Probe = {
    source: -1,
    armed: false,
    second: false,
    holding: false,
    pops: [],
    repairs: [],
    pending: [],
    release: () => {
      probe.holding = false
      for (const execute of probe.pending.splice(0)) {
        execute()
      }
    },
  }
  window.historyProbe = probe
  const index = (): number => {
    const state: unknown = history.state
    if (state !== null && typeof state === 'object' && '__blogHistory' in state) {
      const marker = state.__blogHistory
      if (marker !== null && typeof marker === 'object' && 'index' in marker && typeof marker.index === 'number') {
        return marker.index
      }
    }
    return -1
  }
  const repair = (delta: number, execute: () => void): void => {
    if (probe.armed) {
      probe.repairs.push({ from: index(), delta })
      if (probe.holding) {
        probe.pending.push(execute)
        if (!probe.second && index() === probe.source - 1) {
          probe.second = true
          history.back()
        }
        return
      }
    }
    execute()
  }
  const go = history.go.bind(history)
  history.go = (delta = 0): void => repair(delta, () => go(delta))
  const browser: { navigation?: Navigation } = window
  const native = browser.navigation
  if (native !== undefined) {
    const traverse = native.traverseTo.bind(native)
    native.traverseTo = (key, options): NavigationResult => {
      const target = native.entries().find(item => item.key === key)
      const delta = (target?.index ?? -1) - (native.currentEntry?.index ?? -1)
      const completion = new Promise<NavigationHistoryEntry>((resolve, reject) => {
        repair(delta, () => {
          const result = traverse(key, options)
          result.committed?.catch(reject)
          const finished = result.finished ?? Promise.reject(new Error('Navigation result missing'))
          finished.then(resolve, reject).catch(reject)
        })
      })
      return { committed: completion, finished: completion }
    }
  }
  window.addEventListener('blog:history-pop', () => {
    if (probe.armed) {
      probe.pops.push(index())
    }
  })
}

export async function holdRepair(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.historyProbe.second = true
    window.historyProbe.holding = true
    window.historyProbe.armed = true
  })
}
