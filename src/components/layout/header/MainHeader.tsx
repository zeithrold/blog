import Link from 'next/link'
import PortalButton from './PortalButton'
import ProfileButton from './ProfileButton'

export default function Header() {
  return (
    <div className="navbar">
      <div className="flex-none"></div>
      <div className="flex-1">
        <Link className="btn btn-ghost btn-sm text-lg font-bold" href="/">zeithrold/blog</Link>
      </div>
      <div className="flex-none gap-2 pr-1">
        <PortalButton />
        <ProfileButton />
      </div>
    </div>
  )
}
