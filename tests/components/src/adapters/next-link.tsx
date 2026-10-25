import type { AnchorHTMLAttributes, ReactNode } from 'react'

/**
 * Host-native stand-in for `next/link` in the component harness. It renders the
 * same anchor markup Next produces, while real Next routing remains covered by
 * the browser E2E suite.
 */
export default function HostLink({
  href,
  children,
  ...attributes
}: { href: string, children?: ReactNode } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>): ReactNode {
  return <a href={href} {...attributes}>{children}</a>
}
