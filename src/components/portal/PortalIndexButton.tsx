'use client'

import Link from 'next/link'
import React from 'react'
import { BiSolidArrowToLeft } from 'react-icons/bi'

export default function PortalIndexButton() {
  const [title, setTitle] = React.useState(<span>Blog Portal</span>)
  return (
    <Link
      className="btn btn-primary btn-sm text-lg font-bold"
      href="/"
      onMouseOver={() => setTitle(
        <span className="flex items-center justify-center">
          <BiSolidArrowToLeft className="mr-1 text-xl" />
          Go To Blog
        </span>,
      )}
      onMouseOut={() => setTitle(
        <span>Blog Portal</span>,
      )}
    >
      {title}
    </Link>
  )
}
