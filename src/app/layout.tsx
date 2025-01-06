import { Noto_Sans } from 'next/font/google'
import React from 'react'
import './globals.css'

const noto_sans = Noto_Sans({
  subsets: ['latin'],
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html>
      <body className={`
        ${noto_sans.className}
      `}
      >
        {children}
      </body>
    </html>
  )
}
