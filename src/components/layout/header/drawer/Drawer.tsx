import { SignedIn } from '@clerk/nextjs'
import React from 'react'
import DrawerContent from './DrawerContent'
import OrgSwitchButton from './OrgSwitchButton'
import PortalMenu from './PortalMenu'

export interface DrawerProps {
  labelId: string
  children: React.ReactElement
}

export default function Drawer({
  labelId,
  children,
}: DrawerProps) {
  return (
    <div className="drawer">
      <input type="checkbox" id={labelId} className="drawer-toggle" />
      <div className="drawer-content">
        {children}
      </div>
      <DrawerContent labelId={labelId}>
        <ul className="menu min-h-full w-80 bg-base-200 p-4">
          <SignedIn>
            <li className="btn-primary menu-title">
              Account Switcher
            </li>
            <OrgSwitchButton />
            <PortalMenu />
          </SignedIn>
        </ul>
      </DrawerContent>
    </div>
  )
}
