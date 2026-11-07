import type { ReactNode } from 'react'
import type { MediaLibraryHost } from '@/features/editor/media/media-library'
import type { MediaAsset } from '@/features/media/media-types'
import type { MediaUploadModel } from '@/features/media/upload-queue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/ztd-me/client'
import { MediaLibrary } from '@/features/editor/media/media-library'
import { MediaUploadForm } from '@/features/media/media-upload-form'
import { useEditorLabels } from '@/i18n/use-labels'

export function CoverSources({ workspace, model, select }: {
  workspace: MediaLibraryHost
  model: MediaUploadModel
  select: (asset: MediaAsset) => void
}): ReactNode {
  const text = useEditorLabels()
  return (
    <Tabs defaultValue="upload" className="editor-media-sources min-w-0">
      <TabsList className="flex w-full" aria-label={text('Media source')}>
        <TabsTrigger className="flex-1" value="upload" disabled={model.uploading}>
          {text('Direct upload')}
        </TabsTrigger>
        <TabsTrigger className="flex-1" value="library" disabled={model.uploading}>
          {text('Media library')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="upload">
        <MediaUploadForm model={model} allowRoleChange={false} multiple={false} />
      </TabsContent>
      <TabsContent value="library">
        <MediaLibrary workspace={workspace} role="image" select={select} />
      </TabsContent>
    </Tabs>
  )
}
