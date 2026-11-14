'use client'

import type { ReactNode } from 'react'
import type { LinkProps } from '@/components/ui/ztd-me'
import { Hash, Rss, Search } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PublicMobileMenu } from '@/components/public-mobile-menu'
import { PublicShell } from '@/components/ui/ztd-me/client'
import { useViewportHints } from '@/hooks/use-viewport'
import { useSiteText } from '@/i18n/site-locale'
import { brandClass, brandMarkClass, navClass, navLabelClass, publicChromeClass } from './site-shell-utilities'

function RouterLink(props: LinkProps): ReactNode {
  return <Link {...props} />
}

function BrandMark(): ReactNode {
  return (
    <span className={brandMarkClass} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  )
}

function PublicActions({ pathname }: { readonly pathname: string }): ReactNode {
  const text = useSiteText()
  return (
    <nav
      className="project-actions flex items-center gap-[2px] max-[641px]:gap-1"
      aria-label={text('Site navigation')}
    >
      <Link
        className={navClass}
        href="/tags"
        aria-current={pathname === '/tags' || pathname.startsWith('/tags/') ? 'page' : undefined}
      >
        <Hash size={16} aria-hidden="true" />
        <span className={navLabelClass}>{text('Tags')}</span>
      </Link>
      <Link className={navClass} href="/search" aria-current={pathname === '/search' ? 'page' : undefined}>
        <Search size={16} aria-hidden="true" />
        <span className={navLabelClass}>{text('Search')}</span>
      </Link>
      <a className={`${navClass} max-[641px]:hidden`} href="/rss.xml" aria-label={text('Subscribe via RSS')}>
        <Rss size={16} aria-hidden="true" />
        <span className={navLabelClass}>{text('RSS')}</span>
      </a>
      <PublicMobileMenu />
    </nav>
  )
}

export function SiteShell({ children }: { readonly children: ReactNode }): ReactNode {
  useViewportHints()
  const pathname = usePathname()
  const text = useSiteText()
  return (
    <PublicShell
      brand={{ label: 'zeithrold/blog', homeHref: '/', mark: <BrandMark /> }}
      footer={{
        copyright: '© Zeithrold',
        links: [
          { label: 'GitHub', href: 'https://github.com/zeithrold/blog' },
          { label: 'hello@ztd.me', href: 'mailto:hello@ztd.me' },
          { label: text('Licenses'), href: '/licenses' },
        ],
      }}
      linkComponent={RouterLink}
      chromeClassName={publicChromeClass}
      brandClassName={brandClass}
      projectActions={<PublicActions pathname={pathname} />}
    >
      {children}
    </PublicShell>
  )
}
