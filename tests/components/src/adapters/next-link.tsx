import type { AnchorHTMLAttributes, ReactNode } from 'react'

/**
 * Host-native stand-in for `next/link` in the component harness. It renders the
 * same anchor markup Next produces, while real Next routing remains covered by
 * the browser E2E suite.
 */
export default function HostLink({
  href,
  children,
  onNavigate,
  ...attributes
}: {
  href: string
  children?: ReactNode
  onNavigate?: unknown
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>): ReactNode {
  // Next's client-navigation event has no native-anchor equivalent. Do not
  // forward it as a DOM prop or pretend this host adapter exercises the guard.
  void onNavigate
  return <a href={href} {...attributes}>{children}</a>
}
