'use client'

import { ButtonLink } from '@/components/ui/button'
import { menu } from './menu'

interface HeaderNavLinksProps {
  onNavigate?: () => void
}

/**
 * Site navigation links as shadcn link buttons.
 */
export function HeaderNavLinks({ onNavigate }: HeaderNavLinksProps) {
  return (
    <>
      {menu.map(link => (
        <ButtonLink
          key={link.href}
          href={link.href}
          variant="link"
          onClick={onNavigate}
        >
          {link.label}
        </ButtonLink>
      ))}
    </>
  )
}
