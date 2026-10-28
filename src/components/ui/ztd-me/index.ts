export {
  frontendRootAttributes,
  MAX_PREFERENCE_COOKIE_BYTES,
  preferenceCookie,
  readPreferenceCookie,
  resolveInitialPreferences,
} from './cookies.js'
export { createI18nAdapter, validateI18nResources } from './i18n.js'
export type {
  I18nAdapter,
  I18nCatalog,
  I18nCoverageIssue,
  I18nInstance,
  I18nRequest,
  I18nResources,
  I18nValues,
} from './i18n.js'
export { negotiateLocale } from './locale.js'
export { createPreferencePolicy } from './policy.js'
export { DEFAULT_PREFERENCES, normalizePreferences, serializePreferences } from './preferences.js'
export type {
  ApplicationShellProps,
  Brand,
  FooterLink,
  LinkComponent,
  LinkProps,
  ShellProps,
  SiteFooterProps,
} from './shell-types.js'
export type {
  FrontendPreferences,
  InitialPreferenceOptions,
  Locale,
  Mode,
  Palette,
  PreferenceCookieResult,
  PreferencePolicy,
  PreferencePolicyOptions,
} from './types.js'
export { LOCALES, MODES, PALETTES } from './types.js'

export const GOOGLE_FONTS_SANS_URL = 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400..700&family=Noto+Sans+SC:wght@400..700&family=Noto+Sans+JP:wght@400..700&family=Noto+Sans+KR:wght@400..700&family=Noto+Color+Emoji&display=swap'
export const GOOGLE_FONTS_SERIF_URL = 'https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400..700&family=Noto+Serif+SC:wght@400..700&family=Noto+Serif+JP:wght@400..700&family=Noto+Serif+KR:wght@400..700&display=swap'
