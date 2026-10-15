import type { DefaultReactSuggestionItem } from '@blocknote/react'
import type { DocumentModel } from '@/features/editor/core/model'
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from '@blocknote/core'
import { getDefaultReactSlashMenuItems } from '@blocknote/react'
import { Info, Link, List, MessageSquareText, Network, Sigma, SquarePlay } from 'lucide-react'
import { createElement, useCallback } from 'react'
import { useBlogTranslation } from '@/i18n/use-translation'

const richCommands = [
  { type: 'callout', title: 'slashCallout', description: 'slashCalloutDescription', icon: Info },
  { type: 'footnote', title: 'footnote', description: 'slashFootnoteDescription', icon: MessageSquareText },
  { type: 'math', title: 'slashFormula', description: 'slashFormulaDescription', icon: Sigma },
  { type: 'mermaid', title: 'slashDiagram', description: 'slashDiagramDescription', icon: Network },
  { type: 'toc', title: 'slashTableOfContents', description: 'slashTableOfContentsDescription', icon: List },
  { type: 'linkCard', title: 'linkCard', description: 'slashLinkCardDescription', icon: Link },
  { type: 'embed', title: 'youTubeVideo', description: 'slashVideoDescription', icon: SquarePlay },
] as const

export function useSlashItems(
  editor: DocumentModel['editor'],
): (query: string) => Promise<DefaultReactSuggestionItem[]> {
  const { t } = useBlogTranslation('editor')
  const getItems = useCallback(
    async (query: string) =>
      await Promise.resolve(
        filterSuggestionItems(
          [
            ...getDefaultReactSlashMenuItems(editor),
            ...richCommands.map(({ type, title, description, icon }) => ({
              title: t(title),
              subtext: t(description),
              icon: createElement(icon, { size: 18 }),
              group: t('slashRichContent'),
              aliases: [type],
              onItemClick: () => {
                insertOrUpdateBlockForSlashMenu(editor, { type })
                editor.focus()
              },
            })),
          ],
          query,
        ),
      ),
    [editor, t],
  )
  return getItems
}
