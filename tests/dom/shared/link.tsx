import type { ComponentProps, ReactNode } from 'react'

/** DOM cases inspect anchors; real navigation belongs to built-Worker browser tests. */
export default function Link(props: ComponentProps<'a'>): ReactNode {
  return <a {...props} />
}
