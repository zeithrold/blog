import type { ReactNode } from 'react'
import type { BlockActionsModel } from '@/features/editor/controls/block-actions/block-actions-model'
import { useDictionary } from '@blocknote/react'
import { ColorGrid } from '@/components/ui/ztd-me/ui/color-grid'
import { colorOptions } from '@/features/editor/controls/color-palette'

export function BlockColorGrid({ model }: { model: BlockActionsModel }): ReactNode {
  const { color_picker: text } = useDictionary()
  const { block } = model
  if (block === undefined) {
    return null
  }
  return (
    <div className="grid gap-5">
      {'textColor' in block.props && (
        <ColorGroup title={text.text_title} kind="text" current={block.props.textColor} model={model} />
      )}
      {'backgroundColor' in block.props && (
        <ColorGroup
          title={text.background_title}
          kind="background"
          current={block.props.backgroundColor}
          model={model}
        />
      )}
    </div>
  )
}

function ColorGroup({ title, kind, current, model }: {
  title: string
  kind: 'text' | 'background'
  current: string
  model: BlockActionsModel
}): ReactNode {
  const { color_picker: text } = useDictionary()
  return (
    <div data-color-kind={kind}>
      <ColorGrid
        label={title}
        options={colorOptions(text.colors, kind)}
        value={current}
        disabled={!model.editor.isEditable}
        onValueChange={(color: string) => {
          if (model.block !== undefined && model.editor.isEditable) {
            const props = kind === 'text' ? { textColor: color } : { backgroundColor: color }
            model.editor.updateBlock(model.block, { props })
          }
        }}
      />
    </div>
  )
}
