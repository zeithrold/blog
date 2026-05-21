// Minimal subset of google-fonts-helper for font URL construction
interface FontFamilyConfig {
  wght?: number[]
  ital?: number[]
}

interface ConstructURLOptions {
  families: Record<string, FontFamilyConfig>
  display?: string
}

/**
 *
 */
export function constructURL(options: ConstructURLOptions): string | false {
  const families = Object.entries(options.families)
  if (families.length === 0)
    return false

  const familyParams = families.map(([
    name,
    config,
  ]) => {
    const axes: string[] = []
    if (config.wght != null && config.wght.length > 0)
      axes.push(`wght@${config.wght.join(';')}`)
    if (config.ital != null && config.ital.length > 0)
      axes.push(`ital@${config.ital.join(';')}`)
    const axis = axes.length ? `:${axes.join(',')}` : ''
    return `family=${encodeURIComponent(name)}${axis}`
  }).join('&')

  const display = options.display != null && options.display !== ''
    ? `&display=${options.display}`
    : ''
  return `https://fonts.googleapis.com/css2?${familyParams}${display}`
}
