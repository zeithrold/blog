import type { ReactNode } from 'react'
import { XMLParser } from 'fast-xml-parser'
import { renderToString } from 'katex'
import { createElement } from 'react'
import { displayMathSource } from '@/features/reader/math-source'

const displayClass = [
  'math-display block min-w-0 max-w-full my-[1.6em] mx-0 overflow-x-auto overflow-y-hidden py-[0.5em] text-center',
  '[&>span.katex]:block [&>span.katex]:w-max [&>span.katex]:min-w-full [&>span.katex]:px-[0.125em]',
  '[&_mtable]:[border-spacing:0_0.35em]',
].join(' ')

const tags = new Set([
  'span',
  'math',
  'semantics',
  'annotation',
  'mrow',
  'mi',
  'mn',
  'mo',
  'mtext',
  'mspace',
  'mfrac',
  'msqrt',
  'mroot',
  'msup',
  'msub',
  'msubsup',
  'munder',
  'mover',
  'munderover',
  'mtable',
  'mtr',
  'mtd',
  'mstyle',
  'mpadded',
  'mphantom',
  'menclose',
  'mmultiscripts',
  'mprescripts',
  'none',
])
const attributes = new Set([
  'displaystyle',
  'mathvariant',
  'mathcolor',
  'mathbackground',
  'stretchy',
  'form',
  'fence',
  'separator',
  'accent',
  'accentunder',
  'columnalign',
  'rowalign',
  'rowspacing',
  'columnspacing',
  'linethickness',
  'width',
  'height',
  'depth',
  'lspace',
  'rspace',
  'voffset',
  'notation',
  'scriptlevel',
  'mathsize',
  'minsize',
  'maxsize',
])
const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: false,
})
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid MathML')
  }
  return Object.fromEntries(Object.entries(value))
}
function acceptedAttribute(name: string, value: string): boolean {
  if (name === 'display') {
    return value === 'block' || value === 'inline'
  }
  if (attributes.has(name)) {
    return /^[a-z0-9#.,%+ -]{1,80}$/i.test(value)
  }
  const fixed: Record<string, string> = {
    xmlns: 'http://www.w3.org/1998/Math/MathML',
    encoding: 'application/x-tex',
    class: 'katex',
  }
  return fixed[name] === value
}
function mathAttributes(value: unknown): Record<string, string> {
  const result: Record<string, string> = {}
  if (value === undefined) {
    return result
  }
  for (const [raw, attr] of Object.entries(record(value))) {
    const name = raw.replace(/^@_/, '')
    if (typeof attr === 'string' && acceptedAttribute(name, attr)) {
      result[name === 'class' ? 'className' : name] = attr
    }
  }
  return result
}

function nodes(
  value: unknown,
  budget: {
    count: number
  },
  depth = 0,
): ReactNode[] {
  if (!Array.isArray(value) || depth > 128) {
    throw new Error('Invalid MathML')
  }
  const result: ReactNode[] = []
  for (const entry of value) {
    if (++budget.count > 10000) {
      throw new Error('MathML limit')
    }
    const item = record(entry)
    if (typeof item['#text'] === 'string') {
      result.push(item['#text'])
      continue
    }
    const tag = Object.keys(item).find(key => key !== ':@')
    if (tag === undefined || !tags.has(tag)) {
      throw new Error('Unsupported MathML')
    }
    result.push(
      createElement(
        tag,
        {
          ...mathAttributes(item[':@']),
          key: budget.count,
        },
        ...nodes(item[tag], budget, depth + 1),
      ),
    )
  }
  return result
}
function formula(source: string, display: boolean): ReactNode[] | null {
  try {
    if (/\\(?:href|url|includegraphics|html\w+)\b/i.test(source)) {
      return null
    }
    const xml = renderToString(display ? displayMathSource(source) : source, {
      output: 'mathml',
      displayMode: display,
      trust: false,
      strict: 'error',
      throwOnError: true,
      maxExpand: 1000,
      maxSize: 2,
    })
    if (/<!|<\?/.test(xml)) {
      return null
    }
    const parsed: unknown = parser.parse(xml)
    return nodes(parsed, { count: 0 })
  }
  catch {
    return null
  }
}
export function MathView({
  source,
  display = false,
}: {
  source: string
  display?: boolean
}): ReactNode {
  const tree = formula(source, display)
  return tree === null
    ? (
        <code className="math-error whitespace-pre-wrap">{source}</code>
      )
    : (
        <span
          className={display ? displayClass : 'math-inline'}
        >
          {tree}
        </span>
      )
}
