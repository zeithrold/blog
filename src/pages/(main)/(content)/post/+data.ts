import type { PageContext } from 'vike/types'
import { render } from 'vike/abort'

export default async function data(pageContext: PageContext) {
  const { slug } = pageContext.routeParams
  if (slug === '') {
    throw render(404)
  }
  return {
    slug,
  }
}

export type Data = Awaited<ReturnType<typeof data>>
