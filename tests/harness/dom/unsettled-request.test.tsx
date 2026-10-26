/*
 * A request the case starts but never awaits is still the case's request. Its
 * held handler must make the case fail at teardown (`a request never settled`)
 * rather than escape the record and be answered by the next case's table.
 */
import { it } from 'vitest'
import { defer, serveFetch } from '~/tests/dom/http'

it('starts a held request it never awaits', () => {
  const hold = defer()
  serveFetch({
    'GET /api/admin/held': async () => {
      await hold.promise
      return { body: { ok: true } }
    },
  })
  // No await, no expectServed: only the layer can catch this request. The
  // rejection is handled so the fixture's own body stays green; the handler it is
  // waiting on never settles, which is what teardown must report.
  fetch('/api/admin/held').catch(() => undefined)
})
