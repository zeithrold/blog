import { SingleComponent } from '@/components/helper'
import { OrganizationProfile } from '@clerk/nextjs'

export default function OrgProfilePage() {
  return (
    <SingleComponent>
      <OrganizationProfile />
    </SingleComponent>
  )
}
