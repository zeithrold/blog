import { OrganizationList } from '@clerk/nextjs'
import Description from './Description.mdx'

export default function Guard() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8">
      <div className="prose text-center">
        <Description />
      </div>
      <OrganizationList
        hidePersonal
        afterSelectOrganizationUrl="/portal"
      />
    </div>
  )
}
