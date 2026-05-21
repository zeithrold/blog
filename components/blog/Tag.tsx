import type { PartialSelectResponse } from '@/lib/types/posts'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const colorMap: Record<string, string> = {
  default: 'text-foreground bg-foreground/5 border-foreground/10',
  gray: 'text-muted-foreground bg-muted border-border',
  brown: 'text-amber-700 bg-amber-50 border-amber-100',
  orange: 'text-orange-500 bg-orange-50 border-orange-100',
  yellow: 'text-yellow-600 bg-yellow-50 border-yellow-100',
  green: 'text-green-600 bg-green-50 border-green-100',
  blue: 'text-blue-600 bg-blue-50 border-blue-100',
  purple: 'text-purple-600 bg-purple-50 border-purple-100',
  pink: 'text-pink-600 bg-pink-50 border-pink-100',
  red: 'text-red-600 bg-red-50 border-red-100',
}

/**
 * Notion tag chip linking to the tag filter page.
 */
export function Tag({ color, name, className }: PartialSelectResponse & { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(colorMap[color] ?? colorMap.default, className)}
      render={<Link href={`/tag/${encodeURIComponent(name)}`} />}
    >
      #
      {name}
    </Badge>
  )
}
