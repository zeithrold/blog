import type { LayoutProps } from '@/types'
import { PortalHeader } from '@/components/layout/header'
import { Guard } from '@/components/portal/permission'
import { PORTAL_ORG_SLUG } from '@/constants'
import { auth } from '@clerk/nextjs/server'

export default async function PortalLayout({ children }: LayoutProps) {
  const { orgSlug } = await auth()
  return (
    <div className="flex flex-1 flex-col">
      <PortalHeader />
      {
        orgSlug === PORTAL_ORG_SLUG
          ? children
          : <Guard />
      }
    </div>
  )
}
