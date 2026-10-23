import {
  BlockNoteSchema,
  createHeadingBlockSpec,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
} from '@blocknote/core'
import { checkListItem } from '@/features/editor/blocks/check-list'
import { codeBlock } from '@/features/editor/blocks/code/code-block'
import {
  callout,
  citation,
  embed,
  footnote,
  footnoteRef,
  inlineMath,
  linkCard,
  math,
  mermaid,
  toc,
} from '@/features/editor/blocks/rich-specs'

export const editorSchema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: createHeadingBlockSpec({
      levels: [
        1,
        2,
        3,
      ],
      allowToggleHeadings: false,
    }),
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    checkListItem,
    toggleListItem: defaultBlockSpecs.toggleListItem,
    quote: defaultBlockSpecs.quote,
    codeBlock,
    divider: defaultBlockSpecs.divider,
    table: defaultBlockSpecs.table,
    image: defaultBlockSpecs.image,
    audio: defaultBlockSpecs.audio,
    video: defaultBlockSpecs.video,
    file: defaultBlockSpecs.file,
    callout,
    footnote,
    math,
    mermaid,
    toc,
    linkCard,
    embed,
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    citation,
    footnoteRef,
    inlineMath,
  },
  styleSpecs: defaultStyleSpecs,
})
