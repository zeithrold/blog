import type { KVNamespace } from '@cloudflare/workers-types'

export type NotionBindings = {
  readonly NOTION_API_KEY: string
  readonly NOTION_DATA_SOURCE_ID: string
  readonly NOTION_CACHE: KVNamespace
  readonly NOTION_WEBHOOK_SECRET?: string
  readonly NOTION_WEBHOOK_SUBSCRIPTION_ID?: string
  readonly NOTION_WEBHOOK_SETUP_TOKEN?: string
}
