import type { HistoryEntry, HistoryGuard } from './history-navigation'
import { HistoryNavigation, historyPosition } from './history-navigation'

type Browser = Pick<Window, 'history' | 'location'> & { navigation?: Navigation }

export class HistoryBrowser {
  readonly navigation: HistoryNavigation
  private readonly native: Navigation | null
  private readonly token = crypto.randomUUID()
  private readonly ownedKeys = new Set<string>()

  constructor(
    guard: () => HistoryGuard | null,
    cancelGuard: () => void,
    private readonly browser: Browser = window,
  ) {
    this.native = browser.navigation ?? null
    this.native?.addEventListener('navigate', this.navigating)
    this.navigation = new HistoryNavigation({
      read: () => ({
        href: browser.location.href,
        position: historyPosition(browser.history.state),
        key: this.native?.currentEntry?.key,
      }),
      go: this.go,
      guard,
      cancelGuard,
    })
  }

  pop = (event: Event): void => {
    const key = this.native?.currentEntry?.key
    const owned = key === undefined ? undefined : this.ownedKeys.has(key)
    if (key !== undefined) {
      this.ownedKeys.delete(key)
    }
    if (this.navigation.pop(owned)) {
      event.preventDefault()
    }
  }

  dispose(): void {
    this.native?.removeEventListener('navigate', this.navigating)
    this.ownedKeys.clear()
  }

  private readonly navigating = (event: NavigateEvent): void => {
    const info: unknown = event.info
    if (info !== null && typeof info === 'object' && 'blogHistory' in info && info.blogHistory === this.token) {
      this.ownedKeys.add(event.destination.key)
    }
    else {
      this.ownedKeys.delete(event.destination.key)
    }
  }

  private readonly go = (delta: number, target: HistoryEntry): void => {
    if (this.native !== null && target.key !== undefined) {
      const traversal = this.native.traverseTo(target.key, { info: { blogHistory: this.token } })
      traversal.committed?.catch(() => {})
      traversal.finished?.catch(() => {
        if (this.native?.entries().some(entry => entry.key === target.key) === false) {
          this.navigation.missing(target)
        }
      })
    }
    else {
      this.browser.history.go(delta)
    }
  }
}
