import type { Draft } from '@/features/editor/draft/persistence'
import type { DocumentModel } from '@/features/editor/workspace/document-model'
import type { DepartureSource } from '@/features/editor/workspace/editor-departure'
import type { MediaUploadQueue } from '@/features/media/upload-queue'

export type DepartureQueue = Pick<MediaUploadQueue<string>, 'snapshot'>

/**
 * The workspace fields this policy reads, and nothing else.
 *
 * A whole `Workspace` satisfies it, so the editor is unchanged; naming the
 * boundary is what lets a case mount the real source and the real dialog over a
 * real `DraftCoordinator` and a real upload queue without building the engine,
 * the session or the client a departure never touches.
 */
export type DepartureWorkspace = {
  readonly busy: boolean
  readonly model: Pick<DocumentModel, 'composingRef' | 'hasUploads' | 'waitUploads'>
  readonly draft: Pick<Draft, 'coordinator' | 'persistLocal'>
}

export function departureWaiting(workspace: DepartureWorkspace, queue: DepartureQueue): boolean {
  return workspace.busy || workspace.model.hasUploads()
    || workspace.model.composingRef.current || queue.snapshot().running
}

export function unfinishedUploads(queue: DepartureQueue): boolean {
  return queue.snapshot().items.some(item => item.state === 'queued' || item.state === 'failed')
}

/**
 * The departure policy of one editor document.
 *
 * The route boundary owns this source before any workspace exists: while the
 * entry is loading, or after it failed, there is nothing to wait for and nothing
 * to save, so leaving is a plain document navigation. `attach` supplies the
 * loaded workspace and its upload queue.
 */
export class EditorDepartureSource implements DepartureSource {
  private workspace: DepartureWorkspace | null = null
  private queue: DepartureQueue | null = null

  constructor(readonly navigate: (href: string) => void) {}

  attach(workspace: DepartureWorkspace, queue: DepartureQueue): void {
    this.workspace = workspace
    this.queue = queue
  }

  detach(): void {
    this.workspace = null
    this.queue = null
  }

  blocked = (): boolean => this.workspace !== null && this.queue !== null
    && (this.workspace.draft.coordinator.dirty
      || departureWaiting(this.workspace, this.queue)
      || unfinishedUploads(this.queue))

  wait = async (current: () => boolean): Promise<void> => {
    while (current() && this.workspace !== null && this.queue !== null
      && departureWaiting(this.workspace, this.queue)) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 40)
      })
    }
    if (current() && this.workspace !== null && this.queue !== null) {
      await this.workspace.model.waitUploads()
      if (unfinishedUploads(this.queue)) {
        throw new Error('Finish or remove the queued uploads before leaving.')
      }
    }
  }

  save = async (): Promise<boolean> => this.workspace === null
    ? true
    : await this.workspace.draft.coordinator.settle()

  recover = async (): Promise<boolean> => this.workspace === null
    ? false
    : await this.workspace.draft.persistLocal()

  failure = (): string | null => this.workspace?.draft.coordinator.failureCode ?? null
}
