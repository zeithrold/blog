import type { ReactNode } from 'react'
import type { BlockDifference, FieldDifference, RevisionDifference } from '@/features/history/revision-diff'
import { CheckCircle2, ChevronDown, GitCompareArrows } from 'lucide-react'
import { useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  ScrollArea,
} from '@/components/ui/ztd-me/client'
import { changedTextRange } from '@/features/history/text-difference'
import { useEditorLabels } from '@/i18n/use-labels'
import {
  layout1Class,
  layout2Class,
  layout3Class,
  layout4Class,
  layout5Class,
  layout6Class,
  layout7Class,
  layout8Class,
  layout9Class,
  layout10Class,
  layout11Class,
  layout12Class,
  layout13Class,
} from './revision-diff-view-layout'

const utility1Class = [
  'revision-id text-muted-foreground font-[var(--blog-font-mono)] text-help wrap-anywhere',
].join(' ')

type DiffLabels = { before: string, after: string }
export function RevisionDiffView({ difference, labels: customLabels }: {
  difference: RevisionDifference
  labels?: DiffLabels
}): ReactNode {
  const text = useEditorLabels()
  const labels = customLabels ?? { before: text('Baseline'), after: text('Selected revision') }
  const total = difference.blocks.length + difference.metadata.length
    + difference.references.length + difference.media.length + difference.tables.length
  return (
    <section className={layout1Class} aria-label={text('Revision differences')}>
      <div className={layout2Class}>
        <h2>
          <GitCompareArrows size={18} aria-hidden="true" />
          {text('Revision differences')}
        </h2>
        {total > 0 && <Badge variant="secondary">{`${total} ${text('changes')}`}</Badge>}
      </div>
      {total === 0 && (
        <div className={layout3Class} role="status">
          <CheckCircle2 size={26} aria-hidden="true" />
          <p>{text('These revisions contain the same content.')}</p>
        </div>
      )}
      <FieldDiff title={text('Document metadata')} items={difference.metadata} labels={labels} />
      <FieldDiff title={text('References')} items={difference.references} labels={labels} />
      <FieldDiff title={text('Media accessibility')} items={difference.media} labels={labels} />
      <FieldDiff title={text('Table accessibility')} items={difference.tables} labels={labels} />
      <BlockDiffs blocks={difference.blocks} labels={labels} />
    </section>
  )
}
function BlockDiffs({ blocks, labels }: { blocks: BlockDifference[], labels: DiffLabels }): ReactNode {
  const [limit, setLimit] = useState(50)
  const text = useEditorLabels()
  return blocks.length === 0
    ? null
    : (
        <section className="diff-group grid gap-3 min-w-0">
          <DiffGroupHeading title={text('Content blocks')} count={blocks.length} />
          <ul className="diff-list m-0 p-0 list-none">
            {blocks.slice(0, limit).map(block => <BlockDiff key={block.id} block={block} labels={labels} />)}
          </ul>
          {blocks.length > limit && (
            <Button type="button" variant="outline" onClick={() => setLimit(old => old + 50)}>
              {text('Show more changes')}
            </Button>
          )}
        </section>
      )
}
function FieldDiff({ title, items, labels }: {
  title: string
  items: FieldDifference[]
  labels: DiffLabels
}): ReactNode {
  const text = useEditorLabels()
  return items.length === 0
    ? null
    : (
        <section className="diff-group grid gap-3 min-w-0">
          <DiffGroupHeading title={title} count={items.length} />
          <Accordion type="multiple" className={layout4Class}>
            {items.map(item => (
              <AccordionItem key={item.key} value={item.key}>
                <AccordionTrigger>{text(item.key)}</AccordionTrigger>
                <AccordionContent>
                  <DiffValues before={formatValue(item.before)} after={formatValue(item.after)} labels={labels} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )
}
function BlockDiff({ block, labels }: { block: BlockDifference, labels: DiffLabels }): ReactNode {
  const [open, setOpen] = useState(false)
  const text = useEditorLabels()
  const kinds = { added: 'Added', removed: 'Removed', changed: 'Changed', moved: 'Moved' }
  return (
    <li className={layout5Class} data-change={block.kind}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className={layout6Class}>
          <Badge
            variant="outline"
            className="diff-kind border-border text-muted-foreground text-[length:12px]"
          >
            {text(kinds[block.kind])}
          </Badge>
          <span>{text(blockTypeLabel(block.type))}</span>
          {block.moved && block.kind !== 'moved' && (
            <span className="muted text-muted-foreground">
              {text('Moved')}
            </span>
          )}
          <ChevronDown size={18} aria-hidden="true" />
        </CollapsibleTrigger>
        <CollapsibleContent className="diff-block-content pt-0 px-4 pb-4 max-[701px]:px-3">
          <DiffValues before={block.before} after={block.after} labels={labels} />
          <Accordion type="single" collapsible className={layout7Class}>
            <AccordionItem value="technical">
              <AccordionTrigger>{text('Technical details')}</AccordionTrigger>
              <AccordionContent>
                <p className={utility1Class}>{block.id}</p>
                <FieldDiff title={text('Block properties')} items={block.fields} labels={labels} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CollapsibleContent>
      </Collapsible>
    </li>
  )
}
function DiffValues({ before, after, labels }: { before: string, after: string, labels: DiffLabels }): ReactNode {
  const range = changedTextRange(before, after)
  return (
    <div className={layout8Class}>
      <div className={layout9Class} data-side="before">
        <h4>{labels.before}</h4>
        <ScrollArea className={layout10Class} viewportProps={{ tabIndex: 0 }}>
          <pre>
            {range.prefix}
            <del>{range.removed}</del>
            {range.suffix}
            {before === '' ? '—' : null}
          </pre>
        </ScrollArea>
      </div>
      <div className={layout11Class} data-side="after">
        <h4>{labels.after}</h4>
        <ScrollArea className={layout12Class} viewportProps={{ tabIndex: 0 }}>
          <pre>
            {range.prefix}
            <ins>{range.added}</ins>
            {range.suffix}
            {after === '' ? '—' : null}
          </pre>
        </ScrollArea>
      </div>
    </div>
  )
}
function DiffGroupHeading({ title, count }: { title: string, count: number }): ReactNode {
  return (
    <h3 className={layout13Class}>
      {title}
      <Badge variant="secondary">{count}</Badge>
    </h3>
  )
}
function blockTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    paragraph: 'Paragraph',
    heading: 'Heading',
    bulletListItem: 'Bullet list',
    numberedListItem: 'Numbered list',
    checkListItem: 'Checklist',
    codeBlock: 'Code block',
    quote: 'Quote',
    divider: 'Divider',
    table: 'Table',
    toggleListItem: 'Toggle list',
  }
  return labels[type] ?? type
}
function formatValue(value: unknown): string {
  if (value === undefined) {
    return '—'
  }
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}
