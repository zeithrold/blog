import type { PublicationServer, Stub, StubRoute } from './publication-stub'
import type { Locale } from '@/components/ui/ztd-me'
import type { ScheduleModel, useScheduleList } from '@/features/editor/publication/schedule-controller'
import type { useActions } from '@/features/editor/workspace/actions'
import type { Workspace } from '@/features/editor/workspace/editor-types'

export type PublicationProbe = {
  readonly workspace: Workspace
  readonly actions: ReturnType<typeof useActions>
  readonly schedule: ScheduleModel
  readonly list: ReturnType<typeof useScheduleList>
  readonly settle: () => Promise<void>
  readonly emitContentChange: () => void
  readonly reopenCount: () => number
}

export type PublicationMount = {
  server: PublicationServer
  locale?: Locale
  writes?: Readonly<Record<string, StubRoute>>
  /** Mounts the production header with the host link boundary. */
  header?: { livePath: () => string | null }
}

export type MountedPublication = {
  readonly server: PublicationServer
  readonly stub: Stub
  readonly container: HTMLElement
  readonly state: () => PublicationProbe
  /** Completes one real schedule-list read and the render it causes. */
  readonly load: () => Promise<void>
  /** Awaits every task a rendered control started through the real runner. */
  readonly settle: () => Promise<void>
  readonly editTitle: (title: string) => void
  readonly emitContentChange: () => void
  readonly reopenCount: () => number
  readonly unmount: () => void
}
