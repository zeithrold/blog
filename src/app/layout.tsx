import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { env } from 'cloudflare:workers'
import { headers } from 'next/headers'
import { SiteShell } from '@/components/site-shell'
import {
  createPreferencePolicy,
  frontendRootAttributes,
  GOOGLE_FONTS_SANS_URL,
  GOOGLE_FONTS_SERIF_URL,
  resolveInitialPreferences,
} from '@/components/ui/ztd-me'
import { BlogFrontend } from '@/i18n/frontend'
import { shareImage } from '@/server/reader/share'
import { publicOrigin } from '@/server/runtime/origin'
import './styles.css'

const utility1Class = [
  'm-0 min-w-[min(320px,100%)] bg-background font-sans text-body leading-[1.6] text-foreground',
  'antialiased',
].join(' ')

export function generateMetadata(): Metadata {
  const image = shareImage(publicOrigin(env))
  return {
    title: {
      default: 'zeithrold/blog',
      template: '%s · zeithrold/blog',
    },
    description: 'Notes on building things.',
    openGraph: {
      type: 'website',
      title: 'zeithrold/blog',
      description: 'Notes on building things.',
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'zeithrold/blog',
      description: 'Notes on building things.',
      images: [image],
    },
  }
}
export default async function Layout({
  children,
}: {
  children: ReactNode
}): Promise<ReactNode> {
  const requestHeaders = await headers()
  const policy = createPreferencePolicy({
    name: 'ztd.blog.cms.ui.v1',
    secure: env.PUBLIC_ORIGIN.startsWith('https:'),
  })
  const initial = resolveInitialPreferences({
    policy,
    cookieHeader: requestHeaders.get('cookie') ?? undefined,
    acceptLanguage: requestHeaders.get('accept-language') ?? undefined,
  })
  return (
    <html {...frontendRootAttributes(initial)}>
      <head>
        <meta name="cms-nonce" content={requestHeaders.get('x-blog-nonce') ?? ''} />
        <link rel="stylesheet" href={GOOGLE_FONTS_SANS_URL} />
        <link rel="stylesheet" href={GOOGLE_FONTS_SERIF_URL} />
      </head>
      <body className={utility1Class}>
        <BlogFrontend
          initialPreferences={initial}
          policy={policy}
          styleNonce={requestHeaders.get('x-blog-nonce') ?? undefined}
        >
          <SiteShell>{children}</SiteShell>
        </BlogFrontend>
      </body>
    </html>
  )
}
