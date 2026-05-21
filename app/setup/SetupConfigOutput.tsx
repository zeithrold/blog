'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface SetupConfigOutputProps {
  title: string
  value: string
  onCopy: () => void
  preClassName?: string
}

/**
 * Read-only config output block with copy action.
 */
export function SetupConfigOutput({ title, value, onCopy, preClassName }: SetupConfigOutputProps) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={onCopy}>
          Copy
        </Button>
      </CardHeader>
      <CardContent>
        <pre
          className={cn(
            'max-h-64 overflow-auto rounded-lg border border-border bg-muted p-4 text-xs',
            preClassName,
          )}
        >
          {value}
        </pre>
      </CardContent>
    </Card>
  )
}
