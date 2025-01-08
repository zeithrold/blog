import { SingleComponent } from '@/components/helper'
import { OrganizationProfile, useOrganizationList } from '@clerk/nextjs'
import { redirect } from 'next/navigation'

export default function OrgProfilePage() {
  const { isLoaded, userMemberships } = useOrganizationList()
  if (isLoaded && userMemberships.count === 0) {
    return redirect('/')
  }
  return (
    <SingleComponent>
      <OrganizationProfile />
    </SingleComponent>
  )
}
