import { expect, it } from 'vitest'
import { until } from '~/tests/dom/environment'

it('rejects a throwing condition and detaches it from later changes', async () => {
  const element = document.createElement('div')
  document.body.append(element)
  const deadline = 40
  let calls = 0
  let shouldThrow = false
  const waiting = until(() => {
    calls += 1
    if (shouldThrow) {
      throw new Error('condition failed')
    }
    return false
  }, deadline)

  await Promise.resolve()
  shouldThrow = true
  element.setAttribute('data-throw', 'yes')
  await expect(waiting).rejects.toThrow('condition failed')
  const callsWhenRejected = calls

  element.setAttribute('data-after-error', 'yes')
  await Promise.resolve()
  await new Promise<void>((resolve) => {
    setTimeout(resolve, deadline * 2)
  })

  expect(calls).toBe(callsWhenRejected)
})
