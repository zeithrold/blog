import React from 'react'

export interface DrawerContentProps {
  labelId: string
  children: React.ReactElement
}

export default function DrawerContent({ labelId, children }: DrawerContentProps) {
  return (
    <div className="drawer-side z-20">
      <label
        htmlFor={labelId}
        aria-label="close sidebar"
        className="drawer-overlay"
      />
      {children}
    </div>
  )
}
