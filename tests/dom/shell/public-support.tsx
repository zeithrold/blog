import type { ReactNode } from 'react'
import type { Locale } from '@/components/ui/ztd-me'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createPreferencePolicy } from '@/components/ui/ztd-me'
import { BlogFrontend } from '@/i18n/frontend'

export function mountPublic(children: ReactNode, locale: Locale = 'en'): {
  readonly container: HTMLDivElement
  readonly render: (children: ReactNode) => void
  readonly unmount: () => void
} {
  const policy = createPreferencePolicy({ name: `notion.public.${crypto.randomUUID()}`, secure: false })
  const attributes = [
    'lang',
    'data-frontend-mode',
    'data-frontend-palette',
  ]
    .map(name => [
      name,
      document.documentElement.getAttribute(name),
    ] as const)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const render = (content: ReactNode): void => {
    act(() => root.render(
      <BlogFrontend initialPreferences={{ version: 1, mode: 'light', palette: 'neutral', locale }} policy={policy}>
        {content}
      </BlogFrontend>,
    ))
  }
  render(children)
  return {
    container,
    render,
    unmount: () => {
      act(() => root.unmount())
      container.remove()
      document.cookie = `${policy.name}=; Path=/; Max-Age=0`
      for (const [name, value] of attributes) {
        if (value === null) {
          document.documentElement.removeAttribute(name)
        }
        else {
          document.documentElement.setAttribute(name, value)
        }
      }
    },
  }
}
