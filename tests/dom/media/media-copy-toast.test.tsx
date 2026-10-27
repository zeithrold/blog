import { act } from 'react'
import { toast } from 'sonner'
import { afterEach, expect, it, vi } from 'vitest'
import { one } from '~/tests/dom/shared/dom'
import { until } from '~/tests/dom/shared/environment'
import { mediaAsset, mediaGalleryHandlers, mountMediaGallery, resetMediaDom } from './media-support'

const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

afterEach(() => {
  act(() => {
    toast.dismiss()
  })
  resetMediaDom()
  if (clipboard === undefined) {
    Reflect.deleteProperty(navigator, 'clipboard')
  }
  else {
    Object.defineProperty(navigator, 'clipboard', clipboard)
  }
})

for (const scenario of [
  { locale: 'en', mode: 'light', fails: false, message: 'Link copied', type: 'success', label: 'Notifications' },
  { locale: 'zh-CN', mode: 'dark', fails: false, message: '链接已复制', type: 'success', label: '通知' },
  { locale: 'zh-CN', mode: 'dark', fails: true, message: '无法复制链接。', type: 'error', label: '通知' },
] as const) {
  it(`copy uses a localized ${scenario.type} toast in ${scenario.locale} without changing the card`, async () => {
    const writeText = vi.fn(async () => await (scenario.fails
      ? Promise.reject(new Error('Clipboard permission denied'))
      : Promise.resolve()))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const asset = mediaAsset({
      assetId: '23333333-3333-4333-8333-333333333333',
      filename: 'copy.png',
      role: 'image',
      type: 'image/png',
      bytes: 8,
    })
    const view = mountMediaGallery(mediaGalleryHandlers({ listing: () => [asset] }), {
      width: 390,
      locale: scenario.locale,
      mode: scenario.mode,
    })
    await act(async () => {
      await until(() => view.session.snapshot().loaded)
    })
    const card = one(view.container, '.media-card')
    const before = card.innerHTML
    const copy = one<HTMLButtonElement>(card, '.gallery-copy')
    copy.focus()
    await act(async () => {
      copy.click()
      await until(() => view.container.querySelector('[data-sonner-toast]') !== null)
    })
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/assets/${asset.assetId}`)
    expect(card.innerHTML).toBe(before)
    expect(document.activeElement).toBe(copy)
    const notification = one(view.container, '[data-sonner-toast]')
    expect(notification.getAttribute('data-type')).toBe(scenario.type)
    expect(notification.textContent).toContain(scenario.message)
    expect(one(view.container, 'section[aria-live="polite"]').getAttribute('aria-label')).toContain(scenario.label)
    expect(one(view.container, '[data-sonner-toaster]').getAttribute('data-sonner-theme')).toBe(scenario.mode)
    await act(async () => {
      copy.click()
      await until(() => writeText.mock.calls.length === 2)
    })
    expect(view.container.querySelectorAll('[data-sonner-toast]')).toHaveLength(1)
    expect(card.querySelector('.gallery-copy-notice')).toBeNull()
    await view.api.expectServed()
  })
}
