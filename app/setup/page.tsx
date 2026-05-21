'use client'

import { SetupForm } from './SetupForm'
import { useSetupConfig } from './use-setup-config'

/**
 * Client-side blog config generator (notion token, datasource, site meta).
 */
export default function SetupPage() {
  const config = useSetupConfig()

  return (
    <div className="container mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Blog Config Generator</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generates JSON and Base64 for
          {' '}
          <code className="rounded bg-muted px-1">BLOG_CONFIG</code>
          {' '}
          or
          {' '}
          <code className="rounded bg-muted px-1">BLOG_CONFIG_B64</code>
          . Nothing is sent to a server.
        </p>
      </div>
      <SetupForm config={config} />
    </div>
  )
}
