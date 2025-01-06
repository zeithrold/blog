import type { LayoutProps } from '@/types'
import { MainHeader } from '@/components/layout/header'
import React from 'react'

export default function MainLayout({
  children,
}: LayoutProps) {
  return (
    <div className="flex flex-1 flex-col">
      <MainHeader />
      {children}
    </div>
  )
}
