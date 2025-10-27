import type { GetDataSourceResponse } from '@notionhq/client'
import { createNotionFetch } from '~~/server/lib'

export default defineCachedEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const notionFetch = await createNotionFetch(event)
  const dataSourceId = runtimeConfig.notion.datasourceId
  const dataSourceResponse = await notionFetch<GetDataSourceResponse>(`/data_sources/${dataSourceId}`)
  const tagKey = runtimeConfig.notion.fields.tag
  if (tagKey === ''
    || dataSourceResponse.properties[tagKey] === undefined
    || dataSourceResponse.properties[tagKey].type !== 'multi_select'
  ) {
    return {
      tags: [],
    }
  }
  const tagProperty = dataSourceResponse.properties[tagKey]
  return {
    tags: tagProperty.multi_select.options,
  }
}, {
  maxAge: 60 * 5,
  swr: false,
})
