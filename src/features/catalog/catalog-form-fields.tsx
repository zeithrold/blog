import type { ReactNode } from 'react'
import type { useCatalogManager } from '@/features/catalog/catalog-model'
import { useId } from 'react'
import { Checkbox, Input, Label } from '@/components/ui/ztd-me/client'
import { EditorText } from '@/i18n/labels'
import { utility2Class, utility3Class } from './catalog-utilities'
import { TagColorField } from './tag-color-field'

type Model = ReturnType<typeof useCatalogManager>

export function CatalogFormFields({
  model,
  input,
  kind,
}: {
  model: Model
  input: React.RefObject<HTMLInputElement | null>
  kind: 'tag' | 'series'
}): ReactNode {
  const slugHelpId = useId()
  return (
    <>
      <Label className="grid gap-2">
        <EditorText value="Catalog name" />
        <Input
          ref={input}
          required
          maxLength={200}
          disabled={model.busy}
          value={model.name}
          onChange={event => model.setName(event.currentTarget.value)}
        />
      </Label>
      <Label className="grid gap-2">
        <EditorText value="Catalog slug" />
        <Input
          required
          pattern="[a-z0-9][a-z0-9\-]{0,119}"
          maxLength={120}
          aria-describedby={slugHelpId}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={model.busy}
          value={model.slug}
          onChange={event => model.setSlug(event.currentTarget.value)}
        />
      </Label>
      <p id={slugHelpId} className={utility2Class}>
        <EditorText value="Use lowercase letters, numbers and hyphens." />
      </p>
      {kind === 'tag' && <TagColorField value={model.color} disabled={model.busy} onChange={model.setColor} />}
      {model.edit !== null && (
        <Label className="checkbox-field flex items-center gap-2.5 font-normal">
          <Checkbox
            disabled={model.busy}
            checked={model.retired}
            onCheckedChange={checked => model.setRetired(checked === true)}
          />
          <EditorText value="Retired" />
        </Label>
      )}
      <p className={utility3Class}>
        <EditorText value="Retired entries cannot be added to new drafts. Historical references remain available." />
      </p>
    </>
  )
}
