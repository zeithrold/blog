import { ConfigSchema } from '#shared/schemas'
import { Client } from '@notionhq/client'

export default defineEventHandler(async () => {
  try {
    const { notion } = useRuntimeConfig()
    const { data, success, error } = await ConfigSchema.safeParseAsync(notion)
    if (!success) {
      throw error
    }
    const client = new Client({
      auth: notion.token,
    })
    const response = await client.dataSources.query({
      data_source_id: data.datasourceId,
    })
    return {
      status: 'healthy' as const,
      records: response.results.length,
    }
  }
  catch (error) {
    console.error('Error while retrieving status', error)
    return {
      status: 'unhealthy' as const,
    }
  }
})
