import type { LayoutProps } from '@/types'
import Footer from '@/components/layout/footer/Footer'
import { ClerkProvider } from '@clerk/nextjs'
import React from 'react'
import './globals.css'

export default function RootLayout({
  children,
}: LayoutProps) {
  return (
    <ClerkProvider>
      <html>
        <body>
          <div className="flex min-h-[100vh] flex-col">
            <div className="flex flex-1">
              {children}
            </div>
            <Footer />
          </div>
        </body>
      </html>
    </ClerkProvider>
  )
}
