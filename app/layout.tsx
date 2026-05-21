import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { NavigationProgress } from '@/components/layout/NavigationProgress'
import { getSiteMeta } from '@/lib/config'
import { fontsUrl } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import '@/styles/globals.css'
import '@/styles/notion.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

/**
 *
 */
function safeSiteMeta() {
  try {
    return getSiteMeta()
  }
  catch {
    return {
      name: '@Zeithrold/Blog',
      description: 'Ahead Every Moment - @Zeithrold/Blog',
    }
  }
}

const site = safeSiteMeta()

export const metadata: Metadata = {
  title: {
    default: site.name,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  robots: { index: true, follow: true },
}

/**
 *
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn('font-sans', geist.variable)}>
      <head>
        <link href={fontsUrl} rel="stylesheet" />
        <link href="https://fonts.googleapis.com" rel="preconnect" />
        <link href="https://fonts.gstatic.com" rel="preconnect" crossOrigin="" />
      </head>
      <body id="__zeithrold" className="flex min-h-screen flex-col bg-background pt-12 text-foreground">
        <NavigationProgress />
        <Header />
        <main className="flex-1 flex flex-col">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
