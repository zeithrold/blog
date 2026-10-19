import type { PublicationIssue } from '@/content/publication-issues'
import type { BlogMessageKey } from '@/i18n/instance'

export const issueLabels: Record<PublicationIssue, BlogMessageKey<'editor'>> = {
  title: 'addADocumentTitle',
  slug: 'useAValidUnreservedSlug',
  media: 'completeAccessibilitySettingsForEachMediaBlock',
  image: 'addImageAlternativeTextOrMarkTheImageAsDecorative',
  transcript: 'addTranscriptsForAudioAndVideo',
  table: 'addACaptionToEachTable',
  citation: 'chooseAReferenceForEachCitation',
  footnote: 'chooseAnExistingFootnote',
  diagram: 'fixDiagramBeforePublishing',
  mediaSource: 'selectAFileForEachMediaBlock',
}
