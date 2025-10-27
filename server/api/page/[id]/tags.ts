export default defineCachedEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (typeof id !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'id must be a string',
    })
  }
  const runtimeConfig = useRuntimeConfig(event)
  const response = await $fetch(`/api/page/${id}`)
  const tagObject = runtimeConfig.notion.fields.tag !== '' ? response.properties[runtimeConfig.notion.fields.tag] : undefined
  const tags = tagObject?.type === 'multi_select' ? tagObject.multi_select : []
  return {
    tags,
  }
}, {
  maxAge: 60 * 5,
  swr: false,
})
