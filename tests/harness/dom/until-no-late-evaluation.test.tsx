import { expect, it } from 'vitest'
import { until } from '~/tests/dom/environment'

it('does not re-evaluate a resolved condition after its deadline', async () => {
  const element = document.createElement('div')
  document.body.append(element)
  const deadline = 40
  let calls = 0
  const waiting = until(() => {
    calls += 1
    return element.getAttribute('data-ready') === 'yes'
  }, deadline)

  await Promise.resolve()
  element.setAttribute('data-ready', 'yes')
  await waiting
  const callsWhenResolved = calls

  await new Promise<void>((resolve) => {
    setTimeout(resolve, deadline * 2)
  })

  expect(calls).toBe(callsWhenResolved)
})
