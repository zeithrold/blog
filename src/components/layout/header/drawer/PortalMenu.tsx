import { PORTAL_ORG_SLUG } from '@/constants'
import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'

export default async function PortalMenu() {
  const { orgSlug } = await auth()
  if (!(orgSlug === PORTAL_ORG_SLUG)) {
    return null
  }
  return (
    <>
      <li className="menu-title">
        Portal Menu
      </li>
      <li>
        <Link href="/portal">
          Enter Portal
        </Link>
      </li>
    </>
  )
}
