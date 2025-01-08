import { SignedIn } from '@clerk/nextjs'
import Link from 'next/link'
import { BiMenu } from 'react-icons/bi'
import { Drawer } from './drawer'
import ProfileButton from './ProfileButton'

export default function Header() {
  return (
    <Drawer labelId="drawer">
      <nav className="navbar">
        <div className="flex-none">
          <SignedIn>
            <label
              htmlFor="drawer"
              aria-label="open sidebar"
              className="btn btn-square btn-ghost"
            >
              <BiMenu className="text-xl" />
            </label>
          </SignedIn>
        </div>
        <div className="flex-1">
          <Link className="btn btn-ghost btn-sm text-lg font-bold" href="/">zeithrold/blog</Link>
        </div>
        <div className="flex-none gap-2 pr-1">
          <ProfileButton />
        </div>
      </nav>
    </Drawer>
  )
}
