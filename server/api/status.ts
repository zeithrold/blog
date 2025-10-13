import type { QueryDataSourceResponse } from '@notionhq/client'
import { ConfigSchema } from '#shared/schemas'
import { createNotionFetch } from '~~/server/lib'

export default defineEventHandler(async (event) => {
  try {
    const { notion } = useRuntimeConfig()
    const { data, success, error } = await ConfigSchema.safeParseAsync(notion)
    if (!success) {
      throw error
    }
    const notionFetch = await createNotionFetch(event)
    const response = await notionFetch<QueryDataSourceResponse>(`/data_sources/${data.datasourceId}/query`)
    return {
      status: 'healthy',
      records: response.results.length,
    } as const
  }
  catch (error) {
    console.error('Error while retrieving status', error)
    return {
      status: 'unhealthy' as const,
    } as const
  }
})
