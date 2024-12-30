import type { PageContext } from 'vike/types'
import { redirect } from 'vike/abort'

export async function guard(pageContext: PageContext) {
  if (pageContext.user) {
    throw redirect('/')
  }
}
