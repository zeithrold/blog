/* eslint-disable react-refresh/only-export-components -- Test-only host exports, not application Fast Refresh code. */
import type { ComponentProps, ReactNode } from 'react'

/** Render links as markup only. Routing and navigation are deliberately untested. */
export default function Link(props: ComponentProps<'a'>): ReactNode {
  return <a {...props} />
}

/** Catalog forms import this hook, but these tests must never navigate. */
function router(): { push: (href: string) => never } {
  return {
    push: (href) => {
      throw new Error(`Routing is outside these DOM tests: ${href}`)
    },
  }
}

export { router as useRouter }
