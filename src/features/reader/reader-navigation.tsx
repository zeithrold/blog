'use client'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { useEffect, useRef } from 'react'

const utility1Class = [
  'reader w-[min(var(--blog-reading-width),_calc(100%_-_48px))] min-w-0 my-0 mx-auto pt-14 px-0',
  'pb-22',
].join(' ')

const utility2Class = [
  '[&_h1]:text-[length:clamp(34px,_5vw,_50px)] [&_h1]:tracking-[-0.035em] [&_h1]:leading-[1.15]',
].join(' ')

const utility3Class = [
  '[&:lang(zh-CN)_h1]:tracking-[-0.01em] [&:lang(zh-CN)_h1]:leading-[1.3]',
  '[&_.description]:mt-[18px]',
].join(' ')

const utility4Class = ['[&_.description]:mx-0 [&_.description]:mb-0 [&_.description]:text-muted-foreground'].join(' ')

const utility5Class = [
  '[&_[data-alignment=right]]:text-right [&_[data-alignment=justify]]:[text-align:justify]',
].join(' ')

const utility6Class = [
  '[&_table]:min-w-full [&_table]:[border-collapse:collapse] [&_table]:text-[length:15px]',
].join(' ')

const utility7Class = [
  '[&_table]:leading-[1.6] [&_th]:py-[10px] [&_th]:px-3 [&_th]:border [&_th]:border-border',
].join(' ')

const utility8Class = [
  '[&_th]:text-left [&_th]:[vertical-align:top] [&_td]:py-[10px] [&_td]:px-3 [&_td]:border',
].join(' ')

const utility9Class = ['[&_td]:border-border [&_td]:text-left [&_td]:[vertical-align:top] [&_th]:bg-muted'].join(' ')

const utility10Class = [
  '[&_caption]:text-muted-foreground [&_caption]:text-help [&_caption]:text-left',
  '[&_figure]:my-[2em]',
].join(' ')

const utility11Class = [
  '[&_figure]:mx-0 [&_img]:max-w-full [&_video]:max-w-full [&_audio]:max-w-full [&_img]:h-auto',
].join(' ')

const utility12Class = ['[&_img]:rounded-[12px] [&_video]:h-auto [&_video]:rounded-[12px] [&_audio]:w-full'].join(' ')

const utility13Class = [
  '[&_iframe]:w-full [&_iframe]:border [&_iframe]:border-border [&_iframe]:rounded-[12px]',
].join(' ')

const utility14Class = [
  '[&_figcaption]:mt-[10px] [&_figcaption]:text-muted-foreground [&_figcaption]:text-help',
].join(' ')

const utility15Class = [
  '[&_figcaption]:leading-[1.6] [&_[data-text-color=gray]]:text-[var(--blog-inline-gray)]',
].join(' ')

const utility16Class = ['max-[701px]:[&_.description]:text-[length:16px] max-[360px]:w-[calc(100%_-_32px)]'].join(' ')

const layout1Class = [
  utility1Class,
  'text-[length:17px] leading-[1.85] wrap-anywhere [&:lang(zh-CN)]:leading-[1.95]',
  utility2Class,
  utility3Class,
  utility4Class,
  '[&_.description]:text-[length:18px] [&_.description]:leading-[1.7]',
  '[&_[id]]:[scroll-margin-top:96px] [&_[data-alignment=center]]:text-center',
  utility5Class,
  utility6Class,
  utility7Class,
  utility8Class,
  utility9Class,
  '[&_th]:font-semibold [&_caption]:pt-2 [&_caption]:[caption-side:bottom]',
  utility10Class,
  utility11Class,
  utility12Class,
  utility13Class,
  utility14Class,
  utility15Class,
  '[&_[data-background-color=gray]]:bg-[var(--blog-highlight-gray)]',
  '[&_[data-background-color=gray]]:text-[var(--blog-highlight-foreground)]',
  '[&_[data-text-color=brown]]:text-[var(--blog-inline-brown)]',
  '[&_[data-background-color=brown]]:bg-[var(--blog-highlight-brown)]',
  '[&_[data-background-color=brown]]:text-[var(--blog-highlight-foreground)]',
  '[&_[data-text-color=red]]:text-[var(--blog-inline-red)]',
  '[&_[data-background-color=red]]:bg-[var(--blog-highlight-red)]',
  '[&_[data-background-color=red]]:text-[var(--blog-highlight-foreground)]',
  '[&_[data-text-color=orange]]:text-[var(--blog-inline-orange)]',
  '[&_[data-background-color=orange]]:bg-[var(--blog-highlight-orange)]',
  '[&_[data-background-color=orange]]:text-[var(--blog-highlight-foreground)]',
  '[&_[data-text-color=yellow]]:text-[var(--blog-inline-yellow)]',
  '[&_[data-background-color=yellow]]:bg-[var(--blog-highlight-yellow)]',
  '[&_[data-background-color=yellow]]:text-[var(--blog-highlight-foreground)]',
  '[&_[data-text-color=green]]:text-[var(--blog-inline-green)]',
  '[&_[data-background-color=green]]:bg-[var(--blog-highlight-green)]',
  '[&_[data-background-color=green]]:text-[var(--blog-highlight-foreground)]',
  '[&_[data-text-color=blue]]:text-[var(--blog-inline-blue)]',
  '[&_[data-background-color=blue]]:bg-[var(--blog-highlight-blue)]',
  '[&_[data-background-color=blue]]:text-[var(--blog-highlight-foreground)]',
  '[&_[data-text-color=purple]]:text-[var(--blog-inline-purple)]',
  '[&_[data-background-color=purple]]:bg-[var(--blog-highlight-purple)]',
  '[&_[data-background-color=purple]]:text-[var(--blog-highlight-foreground)]',
  '[&_[data-text-color=pink]]:text-[var(--blog-inline-pink)]',
  '[&_[data-background-color=pink]]:bg-[var(--blog-highlight-pink)]',
  '[&_[data-background-color=pink]]:text-[var(--blog-highlight-foreground)]',
  'max-[701px]:w-[calc(100%_-_40px)] max-[701px]:pt-10 max-[701px]:text-body',
  utility16Class,
].join(' ')

function fragmentTarget(article: HTMLElement, hash: string): HTMLElement | null {
  try {
    const target = document.getElementById(decodeURIComponent(hash.slice(1)))
    return target !== null && article.contains(target) ? target : null
  }
  catch {
    return null
  }
}

function revealTarget(article: HTMLElement, target: HTMLElement): void {
  for (let parent = target.parentElement; parent !== null && parent !== article; parent = parent.parentElement) {
    if (parent instanceof HTMLDetailsElement) {
      parent.open = true
    }
  }
  const first = target.firstElementChild
  const focus = first instanceof HTMLElement && first.matches('h2, h3, h4') ? first : target
  if (focus.tabIndex < 0 && !focus.hasAttribute('tabindex')) {
    focus.tabIndex = -1
  }
  focus.focus({ preventScroll: true })
}

function unmodifiedClick(event: MouseEvent<HTMLElement>): boolean {
  return !event.defaultPrevented && event.button === 0
    && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

function fragmentLink(event: MouseEvent<HTMLElement>): HTMLAnchorElement | null {
  if (!unmodifiedClick(event)) {
    return null
  }
  const link = event.target instanceof Element ? event.target.closest('a') : null
  if (link === null || (link.getAttribute('href') ?? '').startsWith('#') === false) {
    return null
  }
  if (link.hasAttribute('download') || (link.target !== '' && link.target !== '_self')) {
    return null
  }
  return link
}

function unmodifiedKey(event: KeyboardEvent<HTMLElement>): boolean {
  return !event.defaultPrevented && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
}

function scrollDirection(key: string): number {
  if (key === 'ArrowRight') {
    return 1
  }
  return key === 'ArrowLeft' ? -1 : 0
}

function scrollTable(event: KeyboardEvent<HTMLElement>): void {
  if (!unmodifiedKey(event)) {
    return
  }
  const region = event.target instanceof HTMLElement ? event.target : null
  if (region === null || !region.classList.contains('table-scroll')) {
    return
  }
  const direction = scrollDirection(event.key)
  if (direction === 0 || region.scrollWidth <= region.clientWidth) {
    return
  }
  event.preventDefault()
  region.scrollLeft += direction * Math.max(40, Math.round(region.clientWidth / 5))
}

export function ReaderNavigation({
  children,
  language,
}: {
  children: ReactNode
  language: string
}): ReactNode {
  const articleRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const navigate = (): void => {
      const root = articleRef.current
      if (root === null) {
        return
      }
      const target = fragmentTarget(root, window.location.hash)
      if (target !== null) {
        revealTarget(root, target)
        target.scrollIntoView({ block: 'start' })
      }
    }
    navigate()
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [])

  const navigate = (event: MouseEvent<HTMLElement>): void => {
    const link = fragmentLink(event)
    if (link === null) {
      return
    }
    const target = fragmentTarget(event.currentTarget, link.hash)
    if (target !== null) {
      event.preventDefault()
      if (window.location.hash !== link.hash) {
        window.history.pushState(window.history.state, '', link.href)
      }
      revealTarget(event.currentTarget, target)
      target.scrollIntoView({ block: 'start' })
    }
  }

  return (
    <article
      ref={articleRef}
      className={layout1Class}
      lang={language}
      onClick={navigate}
      onKeyDown={scrollTable}
    >
      {children}
    </article>
  )
}
