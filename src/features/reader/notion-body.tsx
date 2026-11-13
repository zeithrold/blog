'use client'

import type { ExtendedRecordMap } from 'notion-types'
import type { ComponentProps, ReactNode } from 'react'
import type { MapPageUrlFn } from 'react-notion-x'
import type { PageSnapshot } from '@/contracts/notion'
import Link from 'next/link'
import { NotionRenderer, useNotionContext } from 'react-notion-x'
import { Code } from 'react-notion-x/third-party/code'
import { Equation } from 'react-notion-x/third-party/equation'

function mappedNotionLink(href: string, mapPageUrl: MapPageUrlFn): string {
  const url = URL.parse(href)
  const notion = url !== null && /(?:^|\.)notion\.(?:so|site|com)$/i.test(url.hostname)
  const id = notion ? /([a-f0-9]{32}|[a-f0-9-]{36})$/i.exec(url.pathname)?.[1] : undefined
  return id === undefined ? href : `${mapPageUrl(id)}${url?.hash ?? ''}`
}

function ReaderLink({ href, children, ...props }: ComponentProps<'a'>): ReactNode {
  const { mapPageUrl } = useNotionContext()
  const mapped = href === undefined ? undefined : mappedNotionLink(href, mapPageUrl)
  if (mapped === undefined || !/^(?:https?:|mailto:|tel:|\/(?!\/)|#)/i.test(mapped)) {
    return <span>{children}</span>
  }
  if (mapped.startsWith('/')) {
    return <Link {...props} href={mapped}>{children}</Link>
  }
  return <a {...props} href={mapped} rel="noopener noreferrer">{children}</a>
}

export function NotionBody({ page }: { readonly page: PageSnapshot }): ReactNode {
  const recordMap: ExtendedRecordMap = page.recordMap
  const links = new Map(Object.entries(page.pageLinks).map(([id, route]) => [
    id.replaceAll('-', '').toLowerCase(),
    route,
  ]))
  const mapPageUrl = (id: string): string => {
    const [pageId = '', fragment] = id.split('#')
    const path = links.get(pageId.replaceAll('-', '').toLowerCase())
      ?? `https://www.notion.so/${pageId.replaceAll('-', '')}`
    return fragment === undefined ? path : `${path}#${fragment}`
  }
  return (
    <NotionRenderer
      recordMap={recordMap}
      blockId={page.item.id}
      fullPage={false}
      disableHeader
      isImageZoomable={false}
      mapPageUrl={mapPageUrl}
      components={{ Code, Equation, Link: ReaderLink, PageLink: ReaderLink }}
      className="reader-body font-serif"
    />
  )
}
