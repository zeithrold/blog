'use client'

import { useMemo, useState } from 'react'
import { defaultConfig, toBase64 } from './config-defaults'

/**
 * Form state and generated BLOG_CONFIG JSON / Base64 for the setup page.
 */

/**
 *
 */
export function useSetupConfig() {
  const [token, setToken] = useState(defaultConfig.notion.token)
  const [datasourceId, setDatasourceId] = useState(defaultConfig.notion.datasourceId)
  const [tagField, setTagField] = useState(defaultConfig.notion.fields.tag)
  const [draftField, setDraftField] = useState(defaultConfig.notion.fields.draft)
  const [siteName, setSiteName] = useState(defaultConfig.site.name)
  const [siteDescription, setSiteDescription] = useState(defaultConfig.site.description)
  const [siteUrl, setSiteUrl] = useState(defaultConfig.site.url)

  const { json, base64 } = useMemo(() => {
    const config = {
      notion: {
        token,
        datasourceId,
        fields: {
          tag: tagField,
          ...(draftField !== '' ? { draft: draftField } : {}),
        },
      },
      site: {
        name: siteName,
        description: siteDescription,
        ...(siteUrl !== '' ? { url: siteUrl } : {}),
      },
    }
    const jsonStr = JSON.stringify(config, null, 2)
    return { json: jsonStr, base64: toBase64(jsonStr) }
  }, [
    token,
    datasourceId,
    tagField,
    draftField,
    siteName,
    siteDescription,
    siteUrl,
  ])

  return {
    token,
    setToken,
    datasourceId,
    setDatasourceId,
    tagField,
    setTagField,
    draftField,
    setDraftField,
    siteName,
    setSiteName,
    siteDescription,
    setSiteDescription,
    siteUrl,
    setSiteUrl,
    json,
    base64,
  }
}
