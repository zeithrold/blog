'use client'

import NextTopLoader from 'nextjs-toploader'

/**
 * Top-of-page progress bar during App Router client navigations.
 */
export function NavigationProgress() {
  return (
    <NextTopLoader
      color="var(--primary)"
      height={3}
      showSpinner={false}
      crawlSpeed={200}
      speed={400}
    />
  )
}
