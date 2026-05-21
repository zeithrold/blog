import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * Homepage hero with branded tagline badges.
 */
export function Identity() {
  return (
    <div className="container mx-auto mt-6 flex w-full max-w-4xl flex-col gap-4 p-4">
      <div className="space-x-2 text-3xl font-bold leading-snug">
        <Badge
          className={cn(
            'h-auto rounded-2xl border border-blue-100 bg-blue-50 px-2 text-3xl! font-bold leading-snug text-blue-500',
          )}
        >
          @Zeithrold
        </Badge>
        <span className="hidden whitespace-nowrap md:inline">is now writing</span>
        <span className="block md:hidden">is now writing</span>
        <Badge
          className={cn(
            'h-auto rounded-2xl border border-amber-100 bg-amber-50 px-2 text-3xl! font-bold leading-snug whitespace-nowrap text-amber-500',
          )}
        >
          the next chapter
        </Badge>
        .
      </div>
    </div>
  )
}
