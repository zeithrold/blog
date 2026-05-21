import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Search placeholder page.
 */
export default function SearchPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Search</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Search is not implemented yet.</p>
        </CardContent>
      </Card>
    </div>
  )
}
