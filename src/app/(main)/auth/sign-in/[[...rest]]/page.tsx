import { SingleComponent } from '@/components/helper'
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <SingleComponent>
      <SignIn />
    </SingleComponent>
  )
}
