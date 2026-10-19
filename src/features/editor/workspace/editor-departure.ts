export type DepartureState = { phase: 'idle' | 'saving' | 'error', error: string, recovered: boolean }
type DepartureTarget = { href: string, commit?: () => void }
export type DepartureSource = {
  wait: (current: () => boolean) => Promise<void>
  save: () => Promise<boolean>
  recover: () => Promise<boolean>
  failure: () => string | null
  navigate: (href: string) => void
}

export class EditorDeparture {
  private state: DepartureState = { phase: 'idle', error: '', recovered: false }
  private readonly listeners = new Set<() => void>()
  private generation = 0
  private target: DepartureTarget | null = null

  constructor(private readonly source: DepartureSource) {}

  snapshot = (): DepartureState => this.state
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  request = (href: string, commit?: () => void): void => {
    this.target = { href, commit }
    const request = ++this.generation
    this.update({ phase: 'saving', error: '', recovered: false })
    this.finish(request).catch(() => {})
  }

  cancel = (): void => {
    this.generation++
    this.target = null
    this.update({ phase: 'idle', error: '', recovered: false })
  }

  retry = (): void => {
    if (this.target !== null && this.state.phase === 'error') {
      this.request(this.target.href, this.target.commit)
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
    if (target.commit !== undefined) {
      target.commit()
    }
    else {
      this.source.navigate(target.href)
    }
  }
}
