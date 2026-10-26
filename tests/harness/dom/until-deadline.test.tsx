/*
 * A condition that never holds must fail at its deadline instead of hanging, and
 * the deadline must be cleared so it cannot fire into a later case:
 * `The DOM state this case waits for never rendered`.
 */
import { it } from 'vitest'
import { until } from '~/tests/dom/environment'

it('waits for a state that never renders', async () => {
  await until(() => false, 50)
})
