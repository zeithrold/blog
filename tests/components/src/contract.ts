export const COMPONENT_SURFACES = [
  'documents',
  'catalog-tag',
  'catalog-series',
  'admin-navigation',
  'admin-controls',
  'media-gallery',
  'reader-content',
  'editor-math',
  'history-page',
  'editor-workspace',
] as const
export const COMPONENT_LOCALES = ['en', 'zh'] as const
export const COMPONENT_MODES = ['light', 'dark'] as const

export type ComponentSurface = (typeof COMPONENT_SURFACES)[number]
export type ComponentLocale = (typeof COMPONENT_LOCALES)[number]
export type ComponentMode = (typeof COMPONENT_MODES)[number]
export type ComponentOptions = {
  surface: ComponentSurface
  locale: ComponentLocale
  mode: ComponentMode
}

/** Read the mount contract from the harness URL and reject unsupported values. */
export function readComponentOptions(params: URLSearchParams): ComponentOptions {
  const surface = params.get('surface')
  if (surface === null || !isComponentSurface(surface)) {
    throw new Error(
      `Unsupported component surface ${JSON.stringify(surface)}. Expected one of: ${COMPONENT_SURFACES.join(', ')}`,
    )
  }
  return {
    surface,
    locale: readChoice(params, 'locale', COMPONENT_LOCALES, 'en'),
    mode: readChoice(params, 'mode', COMPONENT_MODES, 'light'),
  }
}

function isComponentSurface(value: string): value is ComponentSurface {
  return (COMPONENT_SURFACES as readonly string[]).includes(value)
}

function readChoice<T extends string>(
  params: URLSearchParams,
  name: string,
  choices: readonly T[],
  fallback: T,
): T {
  const value = params.get(name)
  if (value === null) {
    return fallback
  }
  const match = choices.find(choice => choice === value)
  if (match === undefined) {
    throw new Error(`Unsupported component ${name} ${JSON.stringify(value)}. Expected one of: ${choices.join(', ')}`)
  }
  return match
}
