export type HostRouter = {
  push: (href: string) => void
  replace: (href: string) => void
  back: () => void
  forward: () => void
  refresh: () => void
  prefetch: (href: string) => void
}

// Only the surface needed by the mounted components is provided. Navigation is a
// real browser navigation, not a Next router; real routing stays in the E2E suite.
const router: HostRouter = {
  push: href => window.location.assign(href),
  replace: href => window.location.replace(href),
  back: () => window.history.back(),
  forward: () => window.history.forward(),
  refresh: () => window.location.reload(),
  prefetch: () => {},
}

// eslint-disable-next-line react/no-unnecessary-use-prefix -- Next.js-compatible adapter export.
export function useRouter(): HostRouter {
  return router
}

// The harness document is a real page load, so its URL is the route the mounted
// shell is on: chrome that branches on the admin section reads that pathname.
// eslint-disable-next-line react/no-unnecessary-use-prefix -- Next.js-compatible adapter export.
export function usePathname(): string {
  return window.location.pathname
}

// eslint-disable-next-line react/no-unnecessary-use-prefix -- Next.js-compatible adapter export.
export function useSearchParams(): URLSearchParams {
  return new URLSearchParams(window.location.search)
}
