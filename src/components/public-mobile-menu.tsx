'use client'

import type { ReactNode } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Ellipsis, Rss } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AppearanceMenu, Button, LocaleSelect, useFrontendPreferences } from '@/components/ui/ztd-me/client'
import { useSiteText } from '@/i18n/site-locale'

const menuClass = [
  'public-mobile-menu ztd-overlay ztd-menu z-50 w-56 max-w-[calc(100vw-32px)]',
  'rounded-xl border border-border bg-surface p-2 font-sans text-control text-foreground shadow-lg',
  '[&_.ztd-wide-label]:hidden',
].join(' ')

export function PublicMobileMenu(): ReactNode {
  const [open, setOpen] = useState(false)
  const { portalContainer } = useFrontendPreferences()
  const text = useSiteText()
  useEffect(() => {
    const wide = matchMedia('(min-width: 641px)')
    const closeWide = (event: MediaQueryListEvent): void => {
      if (event.matches) {
        setOpen(false)
      }
    }
    wide.addEventListener('change', closeWide)
    return () => wide.removeEventListener('change', closeWide)
  }, [])
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="hidden size-11 p-0 max-[641px]:inline-flex"
          aria-label={text('More options')}
        >
          <Ellipsis size={20} aria-hidden="true" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal container={portalContainer}>
        <Popover.Content
          className={menuClass}
          align="end"
          sideOffset={8}
          collisionPadding={16}
          aria-label={text('More options')}
        >
          <div className="flex min-h-11 items-center justify-between pl-2">
            <span>{text('Appearance')}</span>
            <AppearanceMenu />
          </div>
          <div className="flex min-h-11 items-center justify-between pl-2">
            <span>{text('Language')}</span>
            <LocaleSelect />
          </div>
          <div className="my-1 h-px bg-border" />
          <a
            className={[
              'flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-foreground no-underline hover:bg-muted',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
            ].join(' ')}
            href="/rss.xml"
            aria-label={text('Subscribe via RSS')}
          >
            <Rss size={16} aria-hidden="true" />
            {text('RSS')}
          </a>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
