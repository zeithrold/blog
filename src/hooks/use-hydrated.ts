'use client'

import { useSyncExternalStore } from 'react'

const clientSnapshot = (): boolean => true
const serverSnapshot = (): boolean => false
const subscribe = (): (() => void) => () => {}

// False while the server markup is still the live DOM, true once React owns it.
// Rendering both sides from a snapshot keeps hydration consistent without effects.
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot)
}
