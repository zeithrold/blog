import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { BiLogIn } from 'react-icons/bi'

export default function ProfileButton() {
  return (
    <>
      <SignedIn>
        <UserButton
          userProfileUrl="/auth/profile"
        />
      </SignedIn>
      <SignedOut>
        <Link
          className="btn btn-circle btn-ghost"
          href="/auth/sign-in"
        >
          <BiLogIn className="text-xl" />
        </Link>
      </SignedOut>
    </>
  )
}
