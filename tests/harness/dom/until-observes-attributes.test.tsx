/*
 * `until` must observe attribute-only commits: a class or `aria-*` change is a
 * real render, and a case that waits for one must not hang until its deadline.
 */
import { expect, it } from 'vitest'
import { until } from '~/tests/dom/environment'

it('resolves on an attribute-only change', async () => {
  const element = document.createElement('div')
  document.body.append(element)
  const deadline = 500
  const started = Date.now()
  const waiting = until(() => element.getAttribute('data-ready') === 'yes', deadline)
  await Promise.resolve()
  element.setAttribute('data-ready', 'yes')
  await waiting
  expect(element.getAttribute('data-ready')).toBe('yes')
  expect(Date.now() - started).toBeLessThan(deadline / 2)
})
