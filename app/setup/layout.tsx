import type { Metadata } from 'next'
import process from 'node:process'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/**
 *
 */
export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  if (process.env.SETUP_PAGE_ENABLED === 'false') {
    notFound()
  }
  return children
}
