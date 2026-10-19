import type { z } from 'zod'
import type { assetListSchema, assetRoleSchema } from '@/contracts/media'

export type MediaAsset = z.infer<typeof assetListSchema>['items'][number]
export type MediaRole = z.infer<typeof assetRoleSchema>
export type UploadRole = MediaRole | 'auto'

export function inferMediaRole(file: Pick<File, 'type' | 'name'>): MediaRole {
  if (file.type.startsWith('image/')) {
    return 'image'
  }
  if (file.type.startsWith('audio/')) {
    return 'audio'
  }
  if (file.type.startsWith('video/')) {
    return 'video'
  }
  return file.type === 'text/vtt' || /\.vtt$/iu.test(file.name) ? 'caption' : 'file'
}

export const mediaFormats: Record<UploadRole, string> = {
  auto: '.png,.jpg,.jpeg,.mp3,.wav,.mp4,.webm,.pdf,.txt,.zip,.vtt',
  image: '.png,.jpg,.jpeg',
  poster: '.png,.jpg,.jpeg',
  audio: '.mp3,.wav',
  video: '.mp4,.webm',
  file: '.pdf,.txt,.zip',
  caption: '.vtt',
}

export const mediaLimits: Record<UploadRole, string> = {
  auto: 'PNG / JPEG · 8 MiB; MP3 / WAV · 32 MiB; MP4 / WebM · 64 MiB; PDF / TXT / ZIP · 16 MiB; WebVTT · 1 MiB',
  image: 'PNG / JPEG · 8 MiB',
  poster: 'PNG / JPEG · 8 MiB',
  audio: 'MP3 / WAV · 32 MiB',
  video: 'MP4 / WebM · 64 MiB',
  file: 'PDF / TXT / ZIP · 16 MiB',
  caption: 'WebVTT · 1 MiB',
}
