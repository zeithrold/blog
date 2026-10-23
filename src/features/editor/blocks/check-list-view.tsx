import type { ReactCustomBlockRenderProps } from '@blocknote/react'
import type { ReactNode } from 'react'
import type { nativeChecklist } from '@/features/editor/blocks/check-list'
import { Checkbox } from '@/components/ui/ztd-me/client'

import { useBlogTranslation } from '@/i18n/use-translation'

type Props = ReactCustomBlockRenderProps<typeof nativeChecklist.config>

export function ChecklistView({ block, contentRef, editor }: Props): ReactNode {
  const { t } = useBlogTranslation('editor')
  return (
    <div className="flex min-w-0 flex-1 items-start gap-2">
      <span contentEditable={false} className="inline-flex h-7 shrink-0 items-center">
        <Checkbox
          aria-label={t('checklistBlock')}
          checked={block.props.checked}
          disabled={!editor.isEditable}
          onCheckedChange={(checked) => {
            if (editor.isEditable) {
              editor.updateBlock(block, { props: { checked: checked === true } })
            }
          }}
        />
      </span>
      <p ref={contentRef} className="min-w-0 flex-1" />
    </div>
  )
}

export function ChecklistExport({ block, contentRef }: Props): ReactNode {
  return (
    <li>
      <input type="checkbox" checked={block.props.checked} readOnly />
      <p ref={contentRef} />
    </li>
  )
}
