import type { NotionBindings } from '@/server/notion/bindings'

export type Environment = NotionBindings & {
  readonly ASSETS: {
    readonly fetch: (request: Request) => Promise<Response>
  }
  readonly PUBLIC_ORIGIN: string
  readonly BUILD_SHA?: string
}
