import { ConfigSchema } from '#shared/schemas'

export default defineNuxtRouteMiddleware(() => {
  const { notion } = useRuntimeConfig()
  const { success, error } = ConfigSchema.safeParse(notion)
  if (!success) {
    console.warn(`Configuration is invalid: ${error.message}`)
    throw createError({
      statusCode: 500,
      statusMessage: 'Configuration is invalid',
      data: error,
    })
  }
})
