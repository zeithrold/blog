'use client'
import type { ReactNode } from 'react'
import type { LinkProps } from '@/components/ui/ztd-me'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { Activity, ArrowUpRight, ChevronDown, Files, FolderOpen, Image, Rss, Search, Tags } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useRef } from 'react'
import { ApplicationShell, Button, PublicShell } from '@/components/ui/ztd-me/client'
import { useAdminAppbarHeight } from '@/hooks/use-sticky-height'
import { useViewportHints } from '@/hooks/use-viewport'
import { useSiteText } from '@/i18n/site-locale'
import { GuardedLink as Link, NavigationGuardProvider } from '@/shared/admin/navigation-guard'
import {
  utility1Class,
  utility2Class,
  utility3Class,
  utility4Class,
  utility5Class,
  utility6Class,
  utility7Class,
  utility8Class,
  utility9Class,
  utility10Class,
  utility11Class,
  utility12Class,
  utility13Class,
  utility14Class,
  utility15Class,
  utility16Class,
  utility17Class,
  utility18Class,
  utility19Class,
  utility20Class,
  utility21Class,
  utility22Class,
  utility23Class,
  utility24Class,
} from './site-shell-utilities'

const layout1Class = [
  utility1Class,
  '[&_span]:w-[25px] [&_span]:rounded-[3px] [&_span]:bg-accent-foreground',
  '[&_span:nth-child(2)]:w-[19px]',
].join(' ')

const layout2Class = [
  utility2Class,
  utility3Class,
  utility4Class,
  '[&[aria-current=page]::before]:bg-muted [&_svg]:text-[currentcolor]',
].join(' ')

const layout3Class = [
  utility5Class,
  'max-[639.99px]:overflow-hidden max-[639.99px]:[clip-path:inset(50%)]',
  'max-[639.99px]:whitespace-nowrap',
].join(' ')

const layout4Class = [
  utility6Class,
  utility7Class,
  utility8Class,
  '[&[aria-current=page]::before]:bg-muted [&_svg]:text-[currentcolor]',
].join(' ')

const layout5Class = [
  utility9Class,
  'max-[639.99px]:overflow-hidden max-[639.99px]:[clip-path:inset(50%)]',
  'max-[639.99px]:whitespace-nowrap',
].join(' ')

const layout6Class = [
  'admin-sidebar sticky top-[var(--admin-appbar-height)] flex flex-col shrink-0',
  utility10Class,
  utility11Class,
  utility12Class,
  utility13Class,
  '[&_a]:[transition:color_0.12s] [&_a:hover]:text-foreground',
  utility14Class,
  '[&_a[aria-current=page]]:font-semibold',
  utility15Class,
  utility16Class,
  '[&_.admin-sidebar-site]:text-help max-[1023.99px]:hidden',
].join(' ')

const layout7Class = [utility17Class, 'max-[1023.99px]:flex'].join(' ')

const layout8Class = [
  'ztd-overlay ztd-menu',
  utility18Class,
  utility19Class,
  utility20Class,
  utility21Class,
  '[&_[role=menuitem]]:rounded-[8px] [&_[role=menuitem]]:cursor-pointer',
  '[&_[role=menuitemcheckbox]]:flex [&_[role=menuitemcheckbox]]:items-center',
  '[&_[role=menuitemcheckbox]]:gap-2 [&_[role=menuitemcheckbox]]:min-h-11',
  '[&_[role=menuitemcheckbox]]:py-2 [&_[role=menuitemcheckbox]]:px-[10px]',
  utility22Class,
  '[&_[data-highlighted]]:bg-muted [&_[data-highlighted]]:[outline:none]',
].join(' ')

const publicChromeClass = [
  'max-[440px]:flex-wrap max-[440px]:gap-y-1 max-[440px]:py-2',
  'max-[440px]:[&>.ztd-actions]:w-full max-[440px]:[&>.ztd-actions]:justify-between',
  'max-[440px]:[&>.ztd-actions]:flex-wrap max-[440px]:[&>.ztd-actions]:gap-y-1',
].join(' ')

function RouterLink(props: LinkProps): ReactNode {
  return <Link {...props} />
}

function BrandMark(): ReactNode {
  return (
    <span className={layout1Class} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  )
}

function PublicActions({ pathname }: { pathname: string }): ReactNode {
  const text = useSiteText()
  return (
    <nav className="project-actions flex items-center gap-[2px]" aria-label={text('Site navigation')}>
      <Link className={layout2Class} href="/search" aria-current={pathname === '/search' ? 'page' : undefined}>
        <Search size={16} aria-hidden="true" />
        <span className={layout3Class}>
          {text('Search')}
        </span>
      </Link>
      <a className={layout4Class} href="/rss.xml" aria-label={text('Subscribe via RSS')}>
        <Rss size={16} aria-hidden="true" />
        <span className={layout5Class}>
          {text('RSS')}
        </span>
      </a>
    </nav>
  )
}

const adminLinks = [
  { href: '/admin/documents', label: 'Documents', icon: Files },
  { href: '/admin/media', label: 'Media library', icon: Image },
  { href: '/admin/tags', label: 'Tags', icon: Tags },
  { href: '/admin/series', label: 'Series', icon: FolderOpen },
  { href: '/admin/operations', label: 'Operations', icon: Activity },
]

function isCurrent(pathname: string, href: string): boolean {
  return pathname.startsWith(href) || (pathname === '/admin' && href === '/admin/documents')
}

// Wide layouts use the sidebar; narrow layouts keep the compact menu bar. Only one is displayed.
function AdminSidebar({ pathname }: { pathname: string }): ReactNode {
  const text = useSiteText()
  return (
    <aside className={layout6Class}>
      <nav className="admin-sidebar-nav grid" aria-label={text('Admin navigation')}>
        {adminLinks.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={isCurrent(pathname, href) ? 'page' : undefined}>
            <Icon size={16} aria-hidden="true" />
            {text(label)}
          </Link>
        ))}
      </nav>
      <Link className="admin-sidebar-site" href="/">
        {text('View site')}
        <ArrowUpRight size={14} aria-hidden="true" />
      </Link>
    </aside>
  )
}

function AdminNavigation({ pathname }: { pathname: string }): ReactNode {
  const text = useSiteText()
  return (
    <nav className={layout7Class} aria-label={text('Admin navigation')}>
      <AdminMobileNavigation pathname={pathname} links={adminLinks} />
    </nav>
  )
}

function AdminMobileNavigation({ pathname, links }: {
  pathname: string
  links: { href: string, label: string, icon: typeof Files }[]
}): ReactNode {
  const text = useSiteText()
  const { triggerRef, defer, complete } = useMobileNavigationHandoff()
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger asChild>
        <Button ref={triggerRef} type="button" variant="ghost" className="workspace-navigation-mobile">
          {text(links.find(link => pathname.startsWith(link.href))?.label ?? 'Documents')}
          <ChevronDown size={16} aria-hidden="true" />
        </Button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          onCloseAutoFocus={complete}
          className={layout8Class}
          align="start"
          sideOffset={8}
          aria-label={text('Admin navigation')}
        >
          {links.map(({ href, label, icon: Icon }) => (
            <Menu.Item key={href} asChild>
              <Link
                href={href}
                deferGuard={defer}
              >
                <Icon size={18} aria-hidden="true" />
                {text(label)}
              </Link>
            </Menu.Item>
          ))}
          <Menu.Separator className="menu-separator h-px my-1 bg-border" />
          <Menu.Item asChild>
            <Link
              href="/"
              deferGuard={defer}
            >
              {text('View site')}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}

function useMobileNavigationHandoff(): {
  triggerRef: React.RefObject<HTMLButtonElement | null>
  defer: (request: () => void) => void
  complete: (event: Event) => void
} {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pendingRef = useRef<(() => void) | null>(null)
  return {
    triggerRef,
    defer: (request) => { pendingRef.current = request },
    complete: (event) => {
      const pending = pendingRef.current
      pendingRef.current = null
      if (pending !== null) {
        queueMicrotask(pending)
      }
      if (triggerRef.current?.getAttribute('aria-expanded') === 'true') {
        event.preventDefault()
      }
    },
  }
}

export function SiteShell({ children }: { children: ReactNode }): ReactNode {
  return <NavigationGuardProvider><SiteShellContent>{children}</SiteShellContent></NavigationGuardProvider>
}

function SiteShellContent({ children }: { children: ReactNode }): ReactNode {
  useViewportHints()
  const pathname = usePathname()
  useAdminAppbarHeight(pathname.startsWith('/admin'))
  const text = useSiteText()
  const props = {
    brand: {
      label: 'zeithrold/blog',
      homeHref: '/',
      mark: <BrandMark />,
    },
    footer: {
      copyright: '© Zeithrold',
      links: [
        {
          label: 'GitHub',
          href: 'https://github.com/zeithrold/blog',
        },
        {
          label: 'hello@ztd.me',
          href: 'mailto:hello@ztd.me',
        },
        {
          label: text('Licenses'),
          href: '/licenses',
        },
      ],
    },
    linkComponent: RouterLink,
  }
  if (pathname.startsWith('/admin')) {
    return (
      <ApplicationShell
        {...props}
        chromeClassName={utility23Class}
        brandClassName={utility24Class}
        footer={undefined}
        businessNavigation={<AdminNavigation pathname={pathname} />}
        contextSidebar={<AdminSidebar pathname={pathname} />}
      >
        {children}
      </ApplicationShell>
    )
  }
  return (
    <PublicShell
      {...props}
      chromeClassName={publicChromeClass}
      brandClassName={utility24Class}
      projectActions={<PublicActions pathname={pathname} />}
    >
      {children}
    </PublicShell>
  )
}
