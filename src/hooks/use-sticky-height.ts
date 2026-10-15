import { useEffect, useRef } from 'react'

function observeHeight(element: HTMLElement, container: HTMLElement, property: string): () => void {
  const update = (): void => {
    container.style.setProperty(property, `${element.getBoundingClientRect().height}px`)
  }
  update()
  const observer = new ResizeObserver(update)
  observer.observe(element)
  return () => {
    observer.disconnect()
    container.style.removeProperty(property)
  }
}

export function useStickyHeight(property: string): React.RefObject<HTMLElement | null> {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const element = ref.current
    if (element !== null && element.parentElement !== null) {
      return observeHeight(element, element.parentElement, property)
    }
  }, [property])
  return ref
}

export function useAdminAppbarHeight(admin: boolean): void {
  useEffect(() => {
    if (!admin) {
      return
    }
    const shell = document.querySelector<HTMLElement>('.ztd-application')
    const appbar = shell?.querySelector<HTMLElement>(':scope > .ztd-appbar')
    if (shell !== null && appbar !== undefined && appbar !== null) {
      return observeHeight(appbar, shell, '--admin-appbar-height')
    }
  }, [admin])
}
