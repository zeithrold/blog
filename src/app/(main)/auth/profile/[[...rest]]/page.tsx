import { SingleComponent } from '@/components/helper'
import { UserProfile } from '@clerk/nextjs'

export default function ProfilePage() {
  return (
    <SingleComponent>
      <UserProfile />
    </SingleComponent>
  )
}
