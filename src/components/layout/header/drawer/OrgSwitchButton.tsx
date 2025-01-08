import { OrganizationSwitcher, SignedIn } from '@clerk/nextjs'

export default function OrgSwitchButton() {
  return (
    <SignedIn>
      <OrganizationSwitcher />
    </SignedIn>
  )
}
