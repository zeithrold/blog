import type { ReactNode } from 'react'
import type { EditorMediaProps } from '@/features/editor/media/media-upload'
import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/ztd-me/client'
import { MediaLibrary } from '@/features/editor/media/media-library'
import { MediaFields } from '@/features/editor/workspace/accessibility'
import { MediaUploadForm } from '@/features/media/media-upload-form'
import { useEditorLabels } from '@/i18n/use-labels'

export function MediaSources({ workspace, model }: EditorMediaProps): ReactNode {
  const text = useEditorLabels()
  const block = model.target === undefined ? undefined : workspace.model.editor.getBlock(model.target)
  const hasMedia = block !== undefined && 'url' in block.props && block.props.url !== ''
  const [tab, setTab] = useState(hasMedia ? 'details' : 'upload')
  return (
    <Tabs value={tab} onValueChange={setTab} className="editor-media-sources min-w-0">
      <TabsList className="flex w-full" aria-label={text('Media source')}>
        <TabsTrigger className="flex-1" value="upload" disabled={model.uploading}>
          {text('Upload files')}
        </TabsTrigger>
        <TabsTrigger className="flex-1" value="library" disabled={model.uploading}>
          {text('Media library')}
        </TabsTrigger>
        {hasMedia && (
          <TabsTrigger className="flex-1" value="details" disabled={model.uploading}>
            {text('Media details')}
          </TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="upload"><MediaUploadForm model={model} /></TabsContent>
      <TabsContent value="library">
        <MediaLibrary
          workspace={workspace}
          role={model.sourceRole === 'auto' ? undefined : model.sourceRole}
          select={(asset) => {
            model.select(asset)
            model.setOpen(false)
          }}
        />
      </TabsContent>
      {block !== undefined && hasMedia && (
        <TabsContent value="details">
          <MediaFields
            type={block.type}
            value={workspace.model.envelope.mediaAccessibility[block.id]}
            change={(value) => {
              workspace.model.updateFields({
                mediaAccessibility: { ...workspace.model.envelope.mediaAccessibility, [block.id]: value },
              })
              workspace.draft.changed()
            }}
            upload={(role) => {
              model.setRole(role)
              setTab('upload')
            }}
          />
        </TabsContent>
      )}
    </Tabs>
  )
}
