import { PortalIndexButton } from '@/components/portal'
import ProfileButton from './ProfileButton'

export default function PortalHeader() {
  return (
    <div className="navbar">
      <div className="flex-none"></div>
      <div className="flex-1">
        <PortalIndexButton />
      </div>
      <div className="flex-none pr-1">
        <ProfileButton />
      </div>
    </div>
  )
}
