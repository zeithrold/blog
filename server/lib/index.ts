import type { H3Event } from 'h3'
import { NotionAPI } from 'notion-client'

/**
 * Create a new Notion client
 */
export function createNotionClient(event: H3Event) {
  const { token } = useRuntimeConfig(event).notion
  return new NotionAPI({
    authToken: token,
    // // @ts-expect-error - fetch is not defined in the Notion client
    // fetch: event.$fetch,
  })
}
