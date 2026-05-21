import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Deployment instructions for generated blog config.
 */
export function DeployNotes() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deploy</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Local: add to
            <code className="mx-1 rounded bg-muted px-1">.env.local</code>
            as
            <code className="mx-1 rounded bg-muted px-1">BLOG_CONFIG=&apos;...&apos;</code>
          </li>
          <li>
            GitHub Actions: secret
            <code className="mx-1 rounded bg-muted px-1">BLOG_CONFIG_B64</code>
          </li>
          <li>
            Cloudflare:
            <code className="mx-1 rounded bg-muted px-1">wrangler secret put BLOG_CONFIG_B64</code>
          </li>
        </ul>
      </CardContent>
    </Card>
  )
}
