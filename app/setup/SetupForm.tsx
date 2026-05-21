'use client'

import type { ReactNode } from 'react'
import type { useSetupConfig } from './use-setup-config'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DeployNotes } from './DeployNotes'
import { SetupConfigOutput } from './SetupConfigOutput'

type SetupConfig = ReturnType<typeof useSetupConfig>

/**
 * Copy text to the clipboard without returning a promise to React event handlers.
 */
function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text)
}

interface SetupFormProps {
  config: SetupConfig
}

interface SetupFieldProps {
  id: string
  label: string
  children: ReactNode
}

/**
 * Labeled form field for the setup generator.
 */
function SetupField({ id, label, children }: SetupFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

/**
 * Notion/site fields and generated config output for the setup page.
 */
export function SetupForm({ config }: SetupFormProps) {
  return (
    <>
      <section className="grid gap-4">
        <h2 className="font-semibold">Notion</h2>
        <SetupField id="token" label="Integration Token">
          <Input
            id="token"
            type="password"
            value={config.token}
            onChange={e => config.setToken(e.target.value)}
          />
        </SetupField>
        <SetupField id="datasourceId" label="Data Source ID">
          <Input
            id="datasourceId"
            className="font-mono text-sm"
            value={config.datasourceId}
            onChange={e => config.setDatasourceId(e.target.value)}
          />
        </SetupField>
        <SetupField id="tagField" label="Tag field name">
          <Input
            id="tagField"
            value={config.tagField}
            onChange={e => config.setTagField(e.target.value)}
          />
        </SetupField>
        <SetupField id="draftField" label="Draft field name (empty = no filter)">
          <Input
            id="draftField"
            value={config.draftField}
            onChange={e => config.setDraftField(e.target.value)}
          />
        </SetupField>
      </section>

      <section className="grid gap-4">
        <h2 className="font-semibold">Site</h2>
        <SetupField id="siteName" label="Name">
          <Input id="siteName" value={config.siteName} onChange={e => config.setSiteName(e.target.value)} />
        </SetupField>
        <SetupField id="siteDescription" label="Description">
          <Input
            id="siteDescription"
            value={config.siteDescription}
            onChange={e => config.setSiteDescription(e.target.value)}
          />
        </SetupField>
        <SetupField id="siteUrl" label="URL (optional)">
          <Input id="siteUrl" value={config.siteUrl} onChange={e => config.setSiteUrl(e.target.value)} />
        </SetupField>
      </section>

      <SetupConfigOutput title="JSON" value={config.json} onCopy={() => copyToClipboard(config.json)} />
      <SetupConfigOutput
        title="Base64 (BLOG_CONFIG_B64)"
        value={config.base64}
        preClassName="max-h-40 break-all"
        onCopy={() => copyToClipboard(config.base64)}
      />

      <DeployNotes />
    </>
  )
}
