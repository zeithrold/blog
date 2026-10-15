import type { Document } from '@/content/document'

type Reply = {
  id: number
  document?: Document
  error?: string
  status?: number
}

export class SnapshotService {
  private worker: Worker | null = null
  private serial = 0
  private readonly pending = new Map<
    number,
    { resolve: (document: Document) => void, reject: (error: Error) => void }
  >()

  async read(document: unknown): Promise<Document> {
    this.worker ??= this.start()
    const id = ++this.serial
    return await new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker?.postMessage({ id, document })
    })
  }

  dispose(): void {
    this.worker?.terminate()
    this.worker = null
    for (const request of this.pending.values()) {
      request.reject(new Error('Snapshot interrupted'))
    }
    this.pending.clear()
  }

  private start(): Worker {
    const worker = new Worker(new URL('./snapshot-worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.addEventListener('message', (event: MessageEvent<Reply>) => {
      const request = this.pending.get(event.data.id)
      if (request === undefined) {
        return
      }
      this.pending.delete(event.data.id)
      if (event.data.document !== undefined) {
        request.resolve(event.data.document)
      }
      else {
        request.reject(
          Object.assign(new Error(event.data.error ?? 'INVALID_DOCUMENT'), {
            status: event.data.status ?? 422,
          }),
        )
      }
    })
    worker.addEventListener('error', () => {
      this.dispose()
    })
    return worker
  }
}
