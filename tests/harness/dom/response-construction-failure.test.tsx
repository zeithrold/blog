import { it } from 'vitest'
import { serveFetch } from '~/tests/dom/http'

it('records a Response constructor failure from a null-body status', async () => {
  const service = serveFetch({
    'GET /api/admin/no-content': () => ({ status: 204 }),
  })

  await fetch('/api/admin/no-content').catch(() => undefined)
  service.dispose()
})
