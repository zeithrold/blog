import type { H3Event } from 'h3'
import { merge } from 'es-toolkit'

/**
 * Create a new Notion fetch instance
 */
export async function createNotionFetch(event: H3Event) {
  const { token } = useRuntimeConfig(event).notion
  return $fetch.create({
    baseURL: 'https://api.notion.com/v1',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2025-09-03',
    },
  })
}
