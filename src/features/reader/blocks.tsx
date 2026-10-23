import type { ReactNode } from 'react'
import type { Block, BlockType } from '@/content/document'
import type { ReaderContext } from '@/features/reader/context'
import { createElement } from 'react'
import { Callout } from '@/components/ui/callout'
import { Checkbox } from '@/components/ui/ztd-me/client'
import { blockSource } from '@/content/tree'
import { CodeBlock } from '@/features/reader/code-block'
import { contentsHeadings } from '@/features/reader/contents-model'
import { Diagram } from '@/features/reader/diagram'
import { VideoEmbed } from '@/features/reader/embed'
import { Inlines } from '@/features/reader/inlines'
import { MathView } from '@/features/reader/math'
import { MediaView } from '@/features/reader/media'
import { TableView } from '@/features/reader/table'

const utility1Class = [
  'flex min-h-11 cursor-pointer items-center gap-2 font-medium [&::-webkit-details-marker]:hidden',
].join(' ')

const utility2Class = [
  'after:ml-auto after:size-2 after:rotate-45 after:border-r-[1.5px] after:border-b-[1.5px]',
].join(' ')

const utility3Class = [
  'table-of-contents my-[1.4em] mx-0 py-4 px-5 border border-border rounded-[12px] bg-card',
].join(' ')

const utility4Class = [
  '[&_li[data-level=\'2\']]:[margin-inline-start:1em]',
  '[&_li[data-level=\'3\']]:[margin-inline-start:2em]',
].join(' ')

const layout1Class = [
  utility1Class,
  utility2Class,
  'after:border-current after:content-[\'\'] [[open]>&]:after:rotate-[225deg]',
].join(' ')

const layout2Class = [
  utility3Class,
  'text-[length:15px] [&_ol]:mt-2 [&_ol]:mx-0 [&_ol]:mb-0',
  utility4Class,
].join(' ')

const layout3Class = [
  'link-card my-[1.4em] mx-0 py-4 px-5 border border-border rounded-[12px] bg-card',
  '[&_>_:last-child]:mb-0 [transition:border-color_0.2s]',
  'hover:border-[color-mix(in_srgb,_var(--ztd-accent)_45%,_var(--ztd-border))]',
].join(' ')

type Props = {
  block: Block
  context: ReaderContext
}

function Text({ block, context }: Props): ReactNode {
  return Array.isArray(block.content)
    ? (
        <Inlines items={block.content} context={context} blockId={block.id} />
      )
    : null
}
function Heading(props: Props): ReactNode {
  return createElement(`h${Number(props.block.props.level) + 1}`, null, <Text {...props} />)
}
function TableBlock({ block, context }: Props): ReactNode {
  return block.content !== undefined && !Array.isArray(block.content)
    ? (
        <TableView table={block.content} context={context} blockId={block.id} />
      )
    : null
}
function Toggle({ block, context }: Props): ReactNode {
  return (
    <details>
      <summary className={layout1Class}>
        <Text block={block} context={context} />
      </summary>
      <Blocks blocks={block.children} context={context} />
    </details>
  )
}
function Contents({ block, context }: Props): ReactNode {
  const headings = contentsHeadings(context.document.blocks)
  if (headings.length === 0) {
    return null
  }
  return (
    <nav
      className={layout2Class}
      aria-label={
        String(block.props.title).trim() === ''
          ? 'Table of contents'
          : String(block.props.title)
      }
    >
      <h2>
        {String(block.props.title).trim() === '' ? 'Contents' : String(block.props.title)}
      </h2>
      <ol>
        {headings.map(heading => (
          <li key={heading.id} data-level={heading.level}>
            <a href={`#block-${heading.id}`}>{heading.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
const views: Record<BlockType, (props: Props) => ReactNode> = {
  paragraph: props => (
    <p>
      <Text {...props} />
    </p>
  ),
  heading: Heading,
  bulletListItem: Text,
  numberedListItem: Text,
  checkListItem: Text,
  toggleListItem: Toggle,
  quote: props => (
    <blockquote>
      <Text {...props} />
    </blockquote>
  ),
  codeBlock: ({ block }) => (
    <CodeBlock source={blockSource(block)} language={String(block.props.language)} />
  ),
  divider: () => <hr />,
  table: TableBlock,
  image: MediaView,
  video: MediaView,
  audio: MediaView,
  file: MediaView,
  callout: props => (
    <Callout tone={String(props.block.props.tone)}>
      <div className="callout-body min-w-0 whitespace-pre-wrap leading-[1.7] wrap-anywhere">
        <Text {...props} />
      </div>
    </Callout>
  ),
  footnote: () => null,
  math: ({ block }) => <MathView source={blockSource(block)} display />,
  mermaid: ({ block }) => (
    <Diagram source={blockSource(block)} description={String(block.props.description)} />
  ),
  toc: Contents,
  linkCard: ({ block }) => (
    <aside className={layout3Class}>
      <a href={String(block.props.url)} rel="noopener noreferrer">
        {String(block.props.title) === ''
          ? String(block.props.url)
          : String(block.props.title)}
      </a>
      <p>{String(block.props.description)}</p>
    </aside>
  ),
  embed: ({ block }) => (
    <VideoEmbed videoId={String(block.props.videoId)} title={String(block.props.title)} />
  ),
}
function BlockView({ block, context }: Props): ReactNode {
  if (block.type === 'footnote') {
    return null
  }
  return (
    <div
      id={`block-${block.id}`}
      data-text-color={block.props.textColor}
      data-background-color={block.props.backgroundColor}
      data-alignment={block.props.textAlignment}
    >
      {views[block.type]({
        block,
        context,
      })}
      {block.type !== 'toggleListItem' && (
        <Blocks blocks={block.children} context={context} />
      )}
    </div>
  )
}
const listTypes = new Set([
  'bulletListItem',
  'numberedListItem',
  'checkListItem',
])
function grouped(blocks: Block[]): {
  id: string
  list: boolean
  blocks: Block[]
}[] {
  const result: {
    id: string
    list: boolean
    blocks: Block[]
  }[] = []
  for (const block of blocks) {
    const last = result.at(-1)
    if (listTypes.has(block.type) && last?.blocks[0]?.type === block.type) {
      last.blocks.push(block)
    }
    else {
      result.push({
        id: block.id,
        list: listTypes.has(block.type),
        blocks: [block],
      })
    }
  }
  return result
}
function Task({ block, context }: Props): ReactNode {
  const textId = `task-text-${block.id}`
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Checkbox
        checked={block.props.checked === true}
        disabled
        aria-labelledby={textId}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <span id={textId}><Text block={block} context={context} /></span>
        <Blocks blocks={block.children} context={context} />
      </div>
    </div>
  )
}

function List({ blocks, context }: { blocks: Block[], context: ReaderContext }): ReactNode {
  const first = blocks[0]
  const items = blocks.map(block => (
    <li
      key={block.id}
      id={`block-${block.id}`}
      data-text-color={block.props.textColor}
      data-background-color={block.props.backgroundColor}
      data-alignment={block.props.textAlignment}
    >
      {block.type === 'checkListItem'
        ? <Task block={block} context={context} />
        : (
            <>
              <Text block={block} context={context} />
              <Blocks blocks={block.children} context={context} />
            </>
          )}
    </li>
  ))
  if (first?.type === 'numberedListItem') {
    return (
      <ol start={typeof first.props.start === 'number' ? first.props.start : undefined}>
        {items}
      </ol>
    )
  }
  return <ul className={first?.type === 'checkListItem' ? 'task-list list-none p-0' : undefined}>{items}</ul>
}
export function Blocks({
  blocks,
  context,
}: {
  blocks: Block[]
  context: ReaderContext
}): ReactNode {
  return grouped(blocks).map(group =>
    group.list
      ? (
          <List key={group.id} blocks={group.blocks} context={context} />
        )
      : (
          group.blocks.map(block => (
            <BlockView key={block.id} block={block} context={context} />
          ))
        ),
  )
}
