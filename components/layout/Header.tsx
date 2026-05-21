'use client'

import { MenuIcon } from 'lucide-react'
import { useState } from 'react'
import { Button, ButtonLink } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { HeaderNavLinks } from './HeaderNavLinks'

/**
 * Fixed site header with desktop nav and mobile drawer.
 */
export function Header() {
  const [
    open,
    setOpen,
  ] = useState(false)

  return (
    <header className="fixed top-0 right-0 left-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between p-2">
        <div className="flex items-center gap-0.5">
          <ButtonLink href="/" variant="link" className="px-2 text-lg font-bold">
            @Zeithrold
          </ButtonLink>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            Ahead Every Moment
          </span>
        </div>
        <nav className="hidden gap-1 md:flex">
          <HeaderNavLinks />
        </nav>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
              <MenuIcon />
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>@Zeithrold</DrawerTitle>
              <DrawerDescription>Ahead Every Moment</DrawerDescription>
            </DrawerHeader>
            <div className="flex flex-col gap-1 px-4">
              <HeaderNavLinks onNavigate={() => setOpen(false)} />
            </div>
            <DrawerFooter>
              <p className="text-sm text-muted-foreground">Made with care by Zeithrold</p>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    </header>
  )
}
