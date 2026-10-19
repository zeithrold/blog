import type { MediaDestination } from '@/features/editor/media/media-insertion'
import type { MediaRole } from '@/features/media/media-types'

export class MediaDestinations {
  private anchor: string | undefined
  private replace: string | undefined
  private replacing = false
  private positions = new WeakMap<File, Map<MediaRole, MediaDestination>>()

  prepare(anchor: string, replace: string | undefined, reset: boolean): void {
    this.anchor = anchor
    this.replace = replace
    this.replacing = replace !== undefined
    if (reset) {
      this.positions = new WeakMap()
    }
  }

  beginBatch = (): void => {
    this.replace = this.replacing ? this.anchor : undefined
  }

  destination(file: File, role: MediaRole): MediaDestination | undefined {
    if (this.anchor === undefined) {
      return undefined
    }
    const roles = this.positions.get(file) ?? new Map<MediaRole, MediaDestination>()
    const destination = roles.get(role) ?? { anchor: this.anchor, replace: this.replace }
    roles.set(role, destination)
    this.positions.set(file, roles)
    return destination
  }

  selected(): MediaDestination | undefined {
    return this.anchor === undefined
      ? undefined
      : { anchor: this.anchor, replace: this.replacing ? this.anchor : undefined }
  }

  accepted(file: File, role: MediaRole, id: string): void {
    this.positions.get(file)?.delete(role)
    if (role !== 'caption' && role !== 'poster') {
      this.anchor = id
      this.replace = undefined
    }
  }
}
