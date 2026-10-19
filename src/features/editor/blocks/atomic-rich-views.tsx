import type { ReactCustomBlockRenderProps } from '@blocknote/react'
import type { ReactNode } from 'react'
import type * as configs from '@/features/editor/blocks/rich-config'
import { Link2, Video } from 'lucide-react'
import { Input, Label } from '@/components/ui/ztd-me/client'
import { BlockSettings } from '@/features/editor/blocks/block-settings'
import { VideoEmbed } from '@/features/reader/embed'
import { useBlogTranslation } from '@/i18n/use-translation'

const linkFieldLabels = { url: 'uRL', title: 'linkTitle', description: 'linkDescription' } as const
const embedFieldLabels = { videoId: 'youTubeVideoID', title: 'videoTitle' } as const

export function LinkCardView({ block, editor }:
ReactCustomBlockRenderProps<typeof configs.linkCardConfig>): ReactNode {
  const text = useBlogTranslation('editor').t
  return (
    <aside contentEditable={false} className="flex w-full items-start gap-3 rounded-xl border bg-card p-4 font-sans">
      <Link2 size={20} className="mt-1 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium">
          {[block.props.title, block.props.url].find(value => value !== '') ?? text('linkCardEmpty')}
        </p>
        {block.props.description !== '' && (
          <p className="mt-1 text-sm text-muted-foreground">
            {block.props.description}
          </p>
        )}
        {block.props.url !== '' && <p className="mt-2 break-all text-xs text-muted-foreground">{block.props.url}</p>}
      </div>
      <BlockSettings title={text('editLinkCard')} disabled={!editor.isEditable}>
        {([
          'url',
          'title',
          'description',
        ] as const).map(field => (
          <Label key={field} className="grid gap-2">
            {text(linkFieldLabels[field])}
            <Input
              value={block.props[field]}
              maxLength={field === 'url' ? 2048 : 500}
              onChange={(event) => {
                if (editor.isEditable) {
                  editor.updateBlock(block, { props: { [field]: event.currentTarget.value } })
                }
              }}
            />
          </Label>
        ))}
      </BlockSettings>
    </aside>
  )
}

export function EmbedView({ block, editor }:
ReactCustomBlockRenderProps<typeof configs.embedConfig>): ReactNode {
  const text = useBlogTranslation('editor').t
  return (
    <div contentEditable={false} className="w-full rounded-xl border bg-card p-4 font-sans">
      <div className="mb-3 flex items-center gap-3">
        <Video size={20} aria-hidden="true" className="text-muted-foreground" />
        <span className="min-w-0 flex-1 text-sm font-medium">
          {block.props.title !== '' ? block.props.title : text('videoEmpty')}
        </span>
        <BlockSettings title={text('editVideo')} disabled={!editor.isEditable}>
          {(['videoId', 'title'] as const).map(field => (
            <Label key={field} className="grid gap-2">
              {text(embedFieldLabels[field])}
              <Input
                value={block.props[field]}
                maxLength={field === 'videoId' ? 11 : 200}
                onChange={(event) => {
                  if (editor.isEditable) {
                    editor.updateBlock(block, { props: { [field]: event.currentTarget.value } })
                  }
                }}
              />
            </Label>
          ))}
        </BlockSettings>
      </div>
      {/^[\w-]{11}$/.test(block.props.videoId)
        && <VideoEmbed videoId={block.props.videoId} title={block.props.title} />}
    </div>
  )
}
