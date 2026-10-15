import type { ReactNode } from 'react'
import type { Block, Document } from '@/content/document'
import type { ReaderContext } from '@/features/reader/context'
import { mediaURL } from '@/features/reader/context'

const utility1Class = [
  'flex min-h-11 cursor-pointer items-center gap-2 font-medium [&::-webkit-details-marker]:hidden',
].join(' ')

const utility2Class = [
  'after:ml-auto after:size-2 after:rotate-45 after:border-r-[1.5px] after:border-b-[1.5px]',
].join(' ')

const layout1Class = [
  utility1Class,
  utility2Class,
  'after:border-current after:content-[\'\'] [[open]>&]:after:rotate-[225deg]',
].join(' ')

type Media = {
  block: Block
  context: ReaderContext
  src: string
  accessibility: Document['mediaAccessibility'][string] | undefined
}

function Video({ block, context, src, accessibility }: Media): ReactNode {
  const poster = accessibility?.posterAssetId ?? null
  const caption = accessibility?.captionAssetId ?? null
  return (
    <video
      src={src}
      controls
      preload="none"
      aria-label={String(block.props.name)}
      width={
        typeof block.props.previewWidth === 'number' ? block.props.previewWidth : undefined
      }
      poster={poster === null ? undefined : mediaURL(context, poster)}
    >
      {caption !== null && (
        <track
          kind="captions"
          src={mediaURL(context, caption)}
          srcLang={context.document.meta.documentLocale}
          label="Captions"
          default
        />
      )}
    </video>
  )
}
function Preview(input: Media): ReactNode {
  const { block, src, accessibility } = input
  const name = String(block.props.name)
  if (block.props.showPreview === false) {
    return (
      <a href={src} download>
        {name}
      </a>
    )
  }
  const type: string = block.type
  switch (type) {
    case 'image':
      return (
        <img
          src={src}
          loading="lazy"
          alt={accessibility?.decorative === true ? '' : (accessibility?.alt ?? name)}
          width={
            typeof block.props.previewWidth === 'number'
              ? block.props.previewWidth
              : undefined
          }
        />
      )
    case 'audio':
      return <audio src={src} controls preload="none" aria-label={name} />
    case 'video':
      return <Video {...input} />
    default:
      return (
        <a href={src} download>
          {name}
        </a>
      )
  }
}
export function MediaView({
  block,
  context,
}: {
  block: Block
  context: ReaderContext
}): ReactNode {
  const url = block.props.url
  if (typeof url !== 'string' || url === '') {
    return <p>Media has not been uploaded.</p>
  }
  const src = mediaURL(context, url.slice('/assets/'.length))
  const accessibility = context.document.mediaAccessibility[block.id]
  const caption = String(block.props.caption)
  const transcript = accessibility?.transcript ?? ''
  return (
    <figure>
      <Preview block={block} context={context} src={src} accessibility={accessibility} />
      {caption !== '' && <figcaption>{caption}</figcaption>}
      {transcript !== '' && (
        <details>
          <summary className={layout1Class}>Transcript</summary>
          <p className="native-text whitespace-pre-wrap">{transcript}</p>
        </details>
      )}
    </figure>
  )
}
