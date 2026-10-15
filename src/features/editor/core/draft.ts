import type { Document } from '@/content/document'
import type { Acknowledgement } from '@/server/repository'

export type DraftStatus = 'saved' | 'dirty' | 'saving' | 'offline' | 'conflict' | 'error'
type Packet = {
  key: string
  seq: number
  body: {
    expectedVersion: number
    baseRevisionId: string
    reason: 'autosave'
    document: Document
  }
}

export class DraftCoordinator {
  private seq = 0
  private savedSeq = 0
  private packet: Packet | null = null
  private running: Promise<boolean> | null = null
  private runningGeneration = 0
  private metadataBusy = false
  private lastError: string | undefined
  private blocked = false
  private correctable = false
  private conflictCode: string | null = null
  private generation = 0
  private disposed = false
  private idle: ReturnType<typeof setTimeout> | undefined
  private deadline: ReturnType<typeof setTimeout> | undefined
  private retry: ReturnType<typeof setTimeout> | undefined
  private failures = 0
  composing = false
  constructor(
    public acknowledgement: Acknowledgement,
    private readonly snapshot: () => Promise<Document>,
    private readonly send: (packet: Packet) => Promise<Acknowledgement>,
    private readonly status: (
      status: DraftStatus,
      ack: Acknowledgement,
      code?: string,
    ) => void,
  ) {}

  private autoFlush(): void {
    this.flush().catch((error: unknown) => {
      this.blocked = true
      this.lastError = error instanceof Error ? error.message : 'SAVE_FAILED'
      this.status(
        'error',
        this.acknowledgement,
        error instanceof Error ? error.message : 'SAVE_FAILED',
      )
    })
  }

  setComposing(value: boolean): void {
    this.composing = value
  }

  change(): void {
    if (this.correctable) {
      this.blocked = false
      this.packet = null
      this.correctable = false
    }
    this.seq++
    if (this.blocked || this.disposed) {
      return
    }
    this.status('dirty', this.acknowledgement)
    clearTimeout(this.idle)
    this.idle = setTimeout(() => {
      this.autoFlush()
    }, 2000)
    this.deadline ??= setTimeout(() => {
      this.deadline = undefined
      this.autoFlush()
    }, 30000)
  }

  get dirty(): boolean {
    return this.seq > this.savedSeq || this.packet !== null
  }

  get editSeq(): number {
    return this.seq
  }

  get failureCode(): string | null {
    return this.conflictCode ?? this.lastError ?? null
  }

  // A native transaction can arrive while a snapshot is being saved (for example,
  // a media view finishes mounting). Actions must drain those newer edits first.
  async settle(): Promise<boolean> {
    for (;;) {
      const before = this.savedSeq
      if (await this.flush()) {
        return true
      }
      if (this.savedSeq === before || this.blocked || this.disposed || this.composing) {
        return false
      }
    }
  }

  async flush(): Promise<boolean> {
    if (this.running !== null) {
      return await this.waitForSave()
    }
    if (this.disposed || this.blocked || this.composing || this.metadataBusy) {
      return false
    }
    if (!this.dirty) {
      return true
    }
    clearTimeout(this.idle)
    clearTimeout(this.deadline)
    this.deadline = undefined
    this.runningGeneration = this.generation
    this.running = this.perform()
    try {
      return await this.running
    }
    finally {
      this.running = null
    }
  }

  private async waitForSave(): Promise<boolean> {
    const savedBefore = this.savedSeq
    const generation = this.runningGeneration
    await this.running
    const progressed = this.savedSeq > savedBefore || generation !== this.generation
    if (progressed && this.dirty && !this.blocked && !this.disposed) {
      return await this.flush()
    }
    return !this.dirty
  }

  private async perform(): Promise<boolean> {
    const generation = this.generation
    try {
      this.status('saving', this.acknowledgement)
      if (!(this.packet !== null)) {
        const seq = this.seq
        const document = await this.snapshot()
        if (this.disposed || generation !== this.generation) {
          return false
        }
        this.packet = {
          key: crypto.randomUUID(),
          seq,
          body: {
            expectedVersion: this.acknowledgement.version,
            baseRevisionId: this.acknowledgement.headRevisionId,
            reason: 'autosave',
            document,
          },
        }
      }
      const packet = this.packet
      const ack = await this.send(packet)
      if (this.disposed || generation !== this.generation) {
        return false
      }
      this.acknowledgement = ack
      this.savedSeq = packet.seq
      this.packet = null
      this.failures = 0
      this.status(this.dirty ? 'dirty' : 'saved', ack)
      if (this.dirty) {
        this.idle = setTimeout(() => {
          this.autoFlush()
        }, 0)
      }
      return !this.dirty
    }
    catch (error) {
      return generation === this.generation ? this.failed(error) : false
    }
  }

  private failed(error: unknown): false {
    if (this.disposed || this.conflictCode !== null) {
      return false
    }
    const { status, code } = failureDetails(error)
    this.lastError = code
    if (status === 409) {
      this.conflict(code)
    }
    else if (typeof status === 'number' && status >= 400 && status < 500) {
      this.blocked = true
      this.correctable = status === 400 || status === 413 || status === 422
      this.status('error', this.acknowledgement, code)
    }
    else {
      this.status('offline', this.acknowledgement, code)
      if (this.failures++ < 6) {
        this.retry = setTimeout(
          () => {
            this.autoFlush()
          },
          Math.min(30000, 1000 * 2 ** this.failures),
        )
      }
    }
    return false
  }

  resumeAfterCorrection(): void {
    this.generation++
    this.conflictCode = null
    this.blocked = false
    this.packet = null
    this.change()
  }

  conflict(code = 'EDIT_CONFLICT'): void {
    this.generation++
    this.conflictCode = code
    this.blocked = true
    this.correctable = false
    clearTimeout(this.retry)
    this.status('conflict', this.acknowledgement, code)
  }

  // Cancellation changes metadata only. Wait for an in-flight save without
  // requiring a failing or incomplete draft to become saveable first.
  async mutateMetadata(operation: () => Promise<Acknowledgement>): Promise<void> {
    this.metadataBusy = true
    try {
      await this.running
      const ack = await operation()
      if (this.disposed) {
        return
      }
      if (ack.headRevisionId !== this.acknowledgement.headRevisionId) {
        this.conflict()
        return
      }
      this.generation++
      this.packet = null
      this.acknowledgement = ack
      if (this.conflictCode !== null) {
        this.status('conflict', ack, this.conflictCode)
      }
      else if (this.blocked) {
        this.status('error', ack, this.lastError ?? 'SAVE_FAILED')
      }
      else {
        this.status(this.dirty ? 'dirty' : 'saved', ack)
      }
    }
    finally {
      this.metadataBusy = false
      if (this.dirty && !this.blocked && !this.disposed) {
        clearTimeout(this.idle)
        this.idle = setTimeout(() => this.autoFlush(), 0)
      }
    }
  }

  // State-changing publish operations must be serialized after a completed save.
  accept(ack: Acknowledgement): void {
    this.acknowledgement = ack
    if (this.conflictCode !== null) {
      this.status('conflict', ack, this.conflictCode)
    }
    else {
      this.status(this.dirty ? 'dirty' : 'saved', ack)
    }
  }

  dispose(): void {
    this.disposed = true
    clearTimeout(this.idle)
    clearTimeout(this.deadline)
    clearTimeout(this.retry)
  }
}

function failureDetails(error: unknown): { status: number, code: string } {
  const status
    = error !== null
      && typeof error === 'object'
      && 'status' in error
      && typeof error.status === 'number'
      ? error.status
      : 0
  return { status, code: error instanceof Error ? error.message : 'CONNECTION_FAILED' }
}
