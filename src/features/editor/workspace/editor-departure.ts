export type DepartureState = { phase: 'idle' | 'saving' | 'error', error: string, recovered: boolean }
type DepartureTarget = { href: string }
export type DepartureSource = {
  wait: (current: () => boolean) => Promise<void>
  save: () => Promise<boolean>
  recover: () => Promise<boolean>
  failure: () => string | null
  navigate: (href: string) => void
}

/**
 * Approval is consumed by one unload event. Both guards see that same event;
 * a later departure or BFCache restoration cannot reuse it.
 */
export type DeparturePermit = { approved: boolean, event: Event | null }

export function approvedUnload(permit: DeparturePermit | null, event: Event): boolean {
  if (permit === null) {
    return false
  }
  if (permit.event === event) {
    return true
  }
  if (!permit.approved) {
    return false
  }
  permit.approved = false
  permit.event = event
  return true
}

export class EditorDeparture {
  private state: DepartureState = { phase: 'idle', error: '', recovered: false }
  private readonly listeners = new Set<() => void>()
  private generation = 0
  private target: DepartureTarget | null = null

  constructor(private readonly source: DepartureSource, private readonly permit: DeparturePermit) {}

  snapshot = (): DepartureState => this.state
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  request = (href: string): void => {
    this.permit.approved = false
    this.permit.event = null
    this.target = { href }
    const request = ++this.generation
    this.update({ phase: 'saving', error: '', recovered: false })
    this.finish(request).catch(() => {})
  }

  cancel = (): void => {
    this.permit.approved = false
    this.permit.event = null
    this.generation++
    this.target = null
    this.update({ phase: 'idle', error: '', recovered: false })
  }

  retry = (): void => {
    if (this.target !== null && this.state.phase === 'error') {
      this.request(this.target.href)
    }
  }

  leave = (): void => {
    if (this.state.phase === 'error' && this.target !== null) {
      const target = this.target
      this.cancel()
      this.depart(target)
    }
  }

  dispose = (): void => {
    this.permit.approved = false
    this.permit.event = null
    this.generation++
    this.target = null
    this.listeners.clear()
  }

  private async finish(request: number): Promise<void> {
    const current = (): boolean => request === this.generation && this.target !== null
    try {
      await this.source.wait(current)
      if (!current()) {
        return
      }
      if (!(await this.source.save())) {
        const message = this.source.failure()
          ?? 'Your changes could not be saved. Stay here to review the error, or retry.'
        throw new Error(message)
      }
      if (current() && this.target !== null) {
        const target = this.target
        this.cancel()
        this.depart(target)
      }
    }
    catch (failure) {
      if (current()) {
        const recovered = await this.source.recover().catch(() => false)
        if (current()) {
          this.update({ phase: 'error', recovered, error: failure instanceof Error ? failure.message : 'SAVE_FAILED' })
        }
      }
    }
  }

  private update(state: DepartureState): void {
    this.state = state
    for (const listener of this.listeners) {
      listener()
    }
  }

  private depart(target: DepartureTarget): void {
    this.permit.approved = true
    this.permit.event = null
    try {
      this.source.navigate(target.href)
    }
    finally {
      // Native location.assign dispatches beforeunload while starting the
      // departure. If it throws or no unload occurs, no approval may linger.
      this.permit.approved = false
    }
  }
}
