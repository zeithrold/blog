/*
 * A case that sends a request no handler table describes must fail at teardown,
 * even though the case itself never asked whether everything was served. The
 * problem the layer reports is: `a request had no declared handler: ...`.
 */
import { expect, it } from 'vitest'
import { serveFetch } from '~/tests/dom/http'

it('leaves an undeclared request unanswered', async () => {
  serveFetch({})
  const response = await fetch('/api/admin/undeclared')
  expect(response.status).toBe(500)
})
