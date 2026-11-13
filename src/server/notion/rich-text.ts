import type { Color, Decoration, SubDecoration } from 'notion-types'
import type { RichText } from './api'
import type { PublicPath } from '@/contracts/notion'
import { canonicalId } from './api'

const colors: Readonly<Record<string, Color | undefined>> = {
  gray: 'gray',
  brown: 'brown',
  orange: 'orange',
  yellow: 'yellow',
  green: 'teal',
  blue: 'blue',
  purple: 'purple',
  pink: 'pink',
  red: 'red',
  gray_background: 'gray_background',
  brown_background: 'brown_background',
  orange_background: 'orange_background',
  yellow_background: 'yellow_background',
  green_background: 'teal_background',
  blue_background: 'blue_background',
  purple_background: 'purple_background',
  pink_background: 'pink_background',
  red_background: 'red_background',
}

export function publicLink(url: string, links: Readonly<Record<string, PublicPath>>): string | null {
  const parsed = URL.parse(url, 'https://www.notion.so')
  if (parsed === null) {
    return null
  }
  if (!/(?:^|\.)notion\.(?:so|site|com)$/i.test(parsed.hostname)) {
    return [
      'https:',
      'http:',
      'mailto:',
    ].includes(parsed.protocol)
      ? url
      : null
  }
  const id = parsed.pathname.match(/([a-f0-9]{32}|[a-f0-9-]{36})$/i)?.[1]
  if (id === undefined) {
    return null
  }
  const path = links[canonicalId(id)]
  return path === undefined ? null : path + parsed.hash
}

function linkMarks(target: string | null | undefined): SubDecoration[] {
  return typeof target === 'string'
    ? [
        ['a', target],
      ]
    : []
}

function textMarks(text: RichText, links: Readonly<Record<string, PublicPath>>): SubDecoration[] {
  const href = text.text?.link?.url ?? text.href
  return linkMarks(href === null ? null : publicLink(href, links))
}

function semanticMarks(text: RichText, links: Readonly<Record<string, PublicPath>>): SubDecoration[] {
  switch (text.type) {
    case 'text': return textMarks(text, links)
    case 'mention': {
      const id = text.mention?.page?.id
      return linkMarks(id === undefined ? null : links[canonicalId(id)])
    }
    case 'equation': return [
      [
        'e',
        text.equation?.expression ?? text.plain_text,
      ],
    ]
  }
}

export function decorations(texts: readonly RichText[], links: Readonly<Record<string, PublicPath>>): Decoration[] {
  return texts.map((text): Decoration => {
    const marks = semanticMarks(text, links)
    if (text.annotations.bold) {
      marks.push(['b'])
    }
    if (text.annotations.italic) {
      marks.push(['i'])
    }
    if (text.annotations.strikethrough) {
      marks.push(['s'])
    }
    if (text.annotations.underline) {
      marks.push(['_'])
    }
    if (text.annotations.code) {
      marks.push(['c'])
    }
    const color = colors[text.annotations.color]
    if (color !== undefined) {
      marks.push(['h', color])
    }
    return marks.length > 0 ? [text.plain_text, marks] : [text.plain_text]
  })
}
