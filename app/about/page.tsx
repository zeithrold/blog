import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * About page.
 */
export default function AboutPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">About</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Ahead Every Moment — @Zeithrold Blog</p>
        </CardContent>
      </Card>
    </div>
  )
}
