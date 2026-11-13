import { act } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PublicMobileMenu } from '@/components/public-mobile-menu'
import { SiteShell } from '@/components/site-shell'
import { createBlogI18n, serverBlogTranslator } from '@/i18n/instance'
import { en } from '@/i18n/resources/en'
import { zhCN } from '@/i18n/resources/zh-CN'
import { SiteText } from '@/i18n/site-text'
import { installBrowserShims } from '~/tests/dom/shared/environment'
import { mountPublic } from './public-support'

vi.mock('next/navigation', async importOriginal => ({
  ...await importOriginal<typeof import('next/link')>(),
  usePathname: () => '/search',
}))

let view: ReturnType<typeof mountPublic> | undefined

beforeEach(installBrowserShims)
afterEach(() => {
  view?.unmount()
  view = undefined
})

async function interact(action: () => void): Promise<void> {
  await act(async () => {
    action()
    await Promise.resolve()
  })
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (element === null) {
    throw new Error(`Missing rendered control: ${selector}`)
  }
  return element
}

it('keeps the public brand navigation footer and ordinary framework links', () => {
  view = mountPublic(<SiteShell><p>Public content</p></SiteShell>)
  expect(view.container.querySelector('.ztd-brand')?.textContent).toBe('zeithrold/blog')
  expect(view.container.querySelector('a[href="/search"]')?.getAttribute('aria-current')).toBe('page')
  expect(view.container.querySelector('a[href="/rss.xml"]')?.getAttribute('aria-label')).toBe('Subscribe via RSS')
  expect(view.container.querySelector('a[href="/licenses"]')?.textContent).toBe('Licenses')
  expect(view.container.querySelector('main')?.textContent).toBe('Public content')
  expect(view.container.querySelector('a[href^="/admin"], .ztd-application')).toBeNull()
})

it('opens mobile preferences and RSS then restores trigger focus on Escape', async () => {
  view = mountPublic(<PublicMobileMenu />)
  const trigger = required<HTMLButtonElement>('button[aria-label="More options"]')
  expect(trigger.disabled).toBe(false)
  await interact(() => {
    trigger.click()
  })
  expect(required('[role="dialog"]').getAttribute('aria-label')).toBe('More options')
  expect(required('button[aria-label="Appearance"]')).not.toBeNull()
  expect(required('[role="combobox"][aria-label="Language"]')).not.toBeNull()
  expect(required('a[href="/rss.xml"]').textContent).toBe('RSS')
  await interact(() => {
    required('[role="dialog"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

it('closes mobile preferences when crossing into the desktop breakpoint', async () => {
  const original = window.matchMedia.bind(window)
  const wide = new EventTarget()
  vi.stubGlobal('matchMedia', (query: string) => query === '(min-width: 642px)'
    ? Object.assign(original(query), {
        addEventListener: wide.addEventListener.bind(wide),
        removeEventListener: wide.removeEventListener.bind(wide),
      })
    : original(query))
  view = mountPublic(<PublicMobileMenu />)
  await interact(() => {
    required<HTMLButtonElement>('button[aria-label="More options"]').click()
  })
  expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  await interact(() => {
    wide.dispatchEvent(Object.assign(new Event('change'), { matches: true }))
  })
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})

it('updates mounted site text through the retained native locale preference control', async () => {
  view = mountPublic(
    <>
      <PublicMobileMenu />
      <SiteText value="Latest writing" />
    </>,
  )
  await interact(() => {
    required<HTMLButtonElement>('button[aria-label="More options"]').click()
  })
  await interact(() => {
    required('[role="combobox"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
  })
  await interact(() => {
    required('[role="option"][data-state="unchecked"]').dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
    }))
  })
  expect(view.container.textContent).toContain('最新文章')
  expect(document.documentElement.lang).toBe('zh-CN')
})

it('applies the native appearance preference from the mobile menu', async () => {
  view = mountPublic(<PublicMobileMenu />)
  await interact(() => {
    required<HTMLButtonElement>('button[aria-label="More options"]').click()
  })
  await interact(() => {
    required('button[aria-label="Appearance"]').dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
    }))
  })
  const dark = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitemradio"]'))
    .find(option => option.textContent === 'Dark')
  if (dark === undefined) {
    throw new Error('The appearance control did not expose its dark mode choice')
  }
  await interact(() => dark.click())
  expect(document.documentElement.dataset.frontendMode).toBe('dark')
})

it('keeps both locale key sets and interpolation contracts aligned without shared engines', () => {
  expect(Object.keys(en.site).sort()).toEqual(Object.keys(zhCN.site).sort())
  const chineseMessages: Readonly<Record<string, string>> = zhCN.site
  for (const [key, value] of Object.entries(en.site)) {
    expect(String(chineseMessages[key]).match(/\{\{[^}]+\}\}/g) ?? [])
      .toEqual(value.match(/\{\{[^}]+\}\}/g) ?? [])
  }
  const english = createBlogI18n('en')
  const chinese = createBlogI18n('zh-CN')
  expect(english).not.toBe(chinese)
  expect(serverBlogTranslator('en', 'site')('countPosts', { count: 3 })).toBe('3 posts')
  expect(serverBlogTranslator('zh-CN', 'site')('countPosts', { count: 3 })).toBe('3 篇')
  expect(english.language).toBe('en')
})
