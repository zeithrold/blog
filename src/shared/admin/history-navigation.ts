export type HistoryGuard = (href: string, commit: () => void) => void
export type HistoryGuardResolver = () => HistoryGuard | null
export type HistoryEntry = { href: string, key?: string, position: { session: string, index: number } | null }
type Driver = {
  read: () => HistoryEntry
  go: (delta: number, target: HistoryEntry) => void
  guard: () => HistoryGuard | null
  cancelGuard?: () => void
}

export function historyPosition(state: unknown): HistoryEntry['position'] {
  if (!record(state) || !record(state.__blogHistory)) {
    return null
  }
  const value = state.__blogHistory
  return typeof value.session === 'string' && typeof value.index === 'number' && Number.isSafeInteger(value.index)
    ? { session: value.session, index: value.index }
    : null
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

export class HistoryNavigation {
  private visible: HistoryEntry
  private restoring = false
  private allowed: { target: HistoryEntry, generation: number } | null = null
  private approval: { target: HistoryEntry, generation: number } | null = null
  private generation = 0

  constructor(private readonly driver: Driver) {
    this.visible = driver.read()
  }

  sync = (): void => {
    if (!this.restoring) {
      this.written()
    }
  }

  written = (): void => {
    const entry = this.driver.read()
    if (!samePosition(entry, this.visible) || entry.href !== this.visible.href || entry.key !== this.visible.key) {
      this.cancel()
      this.driver.cancelGuard?.()
      this.restoring = false
      this.visible = entry
    }
  }

  missing = (target: HistoryEntry): void => {
    if (target.key === this.visible.key && samePosition(target, this.visible)) {
      this.written()
    }
  }

  cancel = (): void => {
    this.generation++
    this.allowed = null
    this.approval = null
  }

  // Explicit ownership comes from Navigation API info. Older browsers can only
  // recognize the expected repair/approved position from the pop itself.
  pop = (owned?: boolean): boolean => {
    const destination = this.driver.read()
    const expected = (this.restoring && samePosition(destination, this.visible))
      || (this.allowed !== null && samePosition(destination, this.allowed.target))
    return owned === true || (owned === undefined && expected)
      ? this.internal(destination)
      : this.external(destination)
  }

  private external(destination: HistoryEntry): boolean {
    const guard = this.driver.guard()
    const delta = distance(destination, this.visible)
    if (this.restoring && delta === 0) {
      this.cancel()
      this.driver.cancelGuard?.()
      this.restoring = false
      return true
    }
    if (guard !== null && delta !== null && delta !== 0 && !hashOnly(this.visible, destination)) {
      this.cancel()
      this.restoring = true
      this.request(destination)
      this.repair(destination)
      return true
    }
    this.cancel()
    this.driver.cancelGuard?.()
    this.restoring = false
    this.visible = destination
    return false
  }

  private internal(destination: HistoryEntry): boolean {
    const allowed = this.allowed
    if (allowed !== null && allowed.generation === this.generation && samePosition(allowed.target, destination)) {
      this.allowed = null
      this.approval = null
      this.restoring = false
      this.visible = destination
      return false
    }
    if (!samePosition(destination, this.visible)) {
      this.restoring = true
      return this.repair(destination)
    }
    this.restoring = false
    this.proceed()
    return true
  }

  private repair(current: HistoryEntry): boolean {
    const delta = distance(current, this.visible)
    if (delta === null) {
      this.cancel()
      this.restoring = false
      this.visible = current
      return false
    }
    if (delta !== 0) {
      this.driver.go(delta, this.visible)
    }
    return true
  }

  private request(target: HistoryEntry): void {
    const generation = this.generation
    let committed = false
    const commit = (): void => {
      if (!committed && generation === this.generation) {
        committed = true
        this.approval = { target, generation }
        this.proceed()
      }
    }
    const guard = this.driver.guard()
    if (guard === null) {
      commit()
    }
    else {
      guard(target.href, commit)
    }
  }

  private proceed(): void {
    const approval = this.approval
    if (approval === null || this.restoring || !samePosition(this.driver.read(), this.visible)) {
      return
    }
    this.approval = null
    const delta = distance(this.visible, approval.target)
    if (approval.generation === this.generation && delta !== null && delta !== 0) {
      this.allowed = approval
      this.driver.go(delta, approval.target)
    }
  }
}

function distance(from: HistoryEntry, to: HistoryEntry): number | null {
  return from.position !== null && to.position !== null && from.position.session === to.position.session
    ? to.position.index - from.position.index
    : null
}

function samePosition(left: HistoryEntry, right: HistoryEntry): boolean {
  return distance(left, right) === 0
}

function hashOnly(from: HistoryEntry, to: HistoryEntry): boolean {
  const left = new URL(from.href)
  const right = new URL(to.href)
  return left.pathname === right.pathname && left.search === right.search && left.hash !== right.hash
}
