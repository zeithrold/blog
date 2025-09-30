import type { RichTextItemResponse } from '@notionhq/client'

type Annotations = RichTextItemResponse['annotations']
type ApiColor = Annotations['color']

export const colorClassMap: Record<ApiColor, string> = {
  default: 'text-foreground',
  gray: 'text-muted-foreground',
  brown: 'text-amber-700',
  orange: 'text-orange-500',
  yellow: 'text-yellow-500',
  green: 'text-green-500',
  blue: 'text-blue-500',
  purple: 'text-purple-500',
  pink: 'text-pink-500',
  red: 'text-red-500',
  default_background: 'text-foreground',
  gray_background: 'bg-gray-50',
  brown_background: 'text-amber-700 bg-amber-50',
  orange_background: 'text-orange-500 bg-orange-50',
  yellow_background: 'text-yellow-500 bg-yellow-50',
  green_background: 'text-green-500 bg-green-50',
  blue_background: 'text-blue-500 bg-blue-50',
  purple_background: 'text-purple-500 bg-purple-50',
  pink_background: 'text-pink-500 bg-pink-50',
  red_background: 'text-red-500 bg-red-50',
}
