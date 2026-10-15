import { useEffect } from 'react'

export function useViewportHints(): void {
  useEffect(() => {
    // Enable Chrome's keyboard layout resizing only where its keyboard API exists.
    // WebKit rejects this viewport key; retain the framework's single standard tag.
    if (!('virtualKeyboard' in navigator)) {
      return
    }
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
    if (viewport !== null && !viewport.content.includes('interactive-widget=')) {
      viewport.content += ', interactive-widget=resizes-content'
    }
  }, [])
}
