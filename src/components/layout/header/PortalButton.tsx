import { PORTAL_ORG_SLUG } from '@/constants'
import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'

export default async function PortalButton() {
  const { orgSlug } = await auth()
  if (!(orgSlug === PORTAL_ORG_SLUG)) {
    return null
  }
  return (
    <Link className="btn btn-primary btn-sm" href="/portal">
      Portal
    </Link>
  )
}
