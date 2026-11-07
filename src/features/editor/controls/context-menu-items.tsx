import type { ReactNode } from 'react'
import type { EditorContextModel } from '@/features/editor/controls/context-menu-model'
import { useDictionary } from '@blocknote/react'
import * as Menu from '@radix-ui/react-context-menu'
import { Check, ChevronRight } from 'lucide-react'
import { indicatorClass, menuClass, menuItemClass } from '@/components/ui/ztd-me/ui/classes'
import { useTableTargets } from '@/features/editor/blocks/table/table-controls-model'
import { colorOptions } from '@/features/editor/controls/color-palette'
import { contextTableActions } from '@/features/editor/controls/context-menu-table'
import { useBlogTranslation } from '@/i18n/use-translation'

export function ContextMenuItems({ model, portalElement }: {
  model: EditorContextModel
  portalElement: HTMLElement | null
}): ReactNode {
  const dictionary = useDictionary()
  const text = useBlogTranslation('editor').t
  const { editor, target } = model
  const tables = useTableTargets(editor)
  if (target === null) {
    return null
  }
  const block = editor.getBlock(target.id)
  const table = tables.find(item => item.id === target.id)
  return (
    <>
      {target.text && <ContextTextItems model={model} />}
      <Menu.Item className={menuItemClass} onSelect={() => model.run(() => editor.undo())}>{text('undo')}</Menu.Item>
      <Menu.Item className={menuItemClass} onSelect={() => model.run(() => editor.redo())}>{text('redo')}</Menu.Item>
      <ContextColors model={model} portalElement={portalElement} kind="text" />
      <ContextColors model={model} portalElement={portalElement} kind="background" />
      {table !== undefined && target.cell !== null && (
        <>
          <Menu.Separator className="my-1 h-px bg-border" />
          {contextTableActions(editor, table, target.cell, !model.enabled).map(action => (
            <Menu.Item
              key={action.key}
              className={menuItemClass}
              disabled={action.disabled}
              onSelect={() => model.run(action.run)}
            >
              {dictionary.table_handle[action.key]}
            </Menu.Item>
          ))}
        </>
      )}
      <Menu.Separator className="my-1 h-px bg-border" />
      <Menu.Item
        className={`${menuItemClass} text-destructive`}
        onSelect={() => model.run(() => editor.removeBlocks([target.id]))}
      >
        {text(block?.type === 'table' ? 'contextDeleteTable' : 'contextDeleteBlock')}
      </Menu.Item>
    </>
  )
}

function ContextTextItems({ model }: { model: EditorContextModel }): ReactNode {
  const dictionary = useDictionary().formatting_toolbar
  const choices = [
    'bold',
    'italic',
    'underline',
    'strike',
    'code',
  ] as const
  return choices.map(style => (
    <Menu.CheckboxItem
      key={style}
      className={menuItemClass}
      checked={model.editor.getActiveStyles()[style] === true}
      onSelect={() => model.run(() => model.editor.toggleStyles({ [style]: true }))}
    >
      {dictionary[style].tooltip}
      <Menu.ItemIndicator className={indicatorClass}><Check size={14} /></Menu.ItemIndicator>
    </Menu.CheckboxItem>
  ))
}

function ContextColors({ model, portalElement, kind }: {
  model: EditorContextModel
  portalElement: HTMLElement | null
  kind: 'text' | 'background'
}): ReactNode {
  const dictionary = useDictionary().color_picker
  const { editor, target } = model
  const property = kind === 'text' ? 'textColor' : 'backgroundColor'
  const block = target === null ? undefined : editor.getBlock(target.id)
  if (target === null || block === undefined || (!target.text && !(property in block.props))) {
    return null
  }
  const value = currentColor(model, property)
  return (
    <Menu.Sub>
      <Menu.SubTrigger className={menuItemClass}>
        {kind === 'text' ? dictionary.text_title : dictionary.background_title}
        <ChevronRight className={indicatorClass} size={14} aria-hidden="true" />
      </Menu.SubTrigger>
      <Menu.Portal container={portalElement ?? undefined}>
        <Menu.SubContent className={`${menuClass} z-[170] min-w-40`} collisionPadding={12}>
          <Menu.RadioGroup
            value={value}
            onValueChange={color => model.run(() => {
              const props = { [property]: color }
              if (!target.text) {
                editor.updateBlock(block, { props })
              }
              else if (color === 'default') {
                editor.removeStyles(props)
              }
              else {
                editor.addStyles(props)
              }
            })}
          >
            {colorOptions(dictionary.colors, kind).map(color => (
              <Menu.RadioItem key={color.value} value={color.value} className={menuItemClass}>
                <span
                  className="size-3 rounded-sm border border-border"
                  style={{ color: color.foreground, background: color.background }}
                  aria-hidden="true"
                >
                  A
                </span>
                {color.label}
                <Menu.ItemIndicator className={indicatorClass}><Check size={14} /></Menu.ItemIndicator>
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.SubContent>
      </Menu.Portal>
    </Menu.Sub>
  )
}

function currentColor(model: EditorContextModel, property: 'textColor' | 'backgroundColor'): string {
  const target = model.target
  if (target === null) {
    return 'default'
  }
  if (target.text) {
    return model.editor.getActiveStyles()[property] ?? 'default'
  }
  const block = model.editor.getBlock(target.id)
  if (block === undefined) {
    return 'default'
  }
  if (property === 'textColor' && 'textColor' in block.props) {
    return block.props.textColor
  }
  if ('backgroundColor' in block.props) {
    return block.props.backgroundColor
  }
  return 'default'
}
