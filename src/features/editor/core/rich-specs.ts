import { createReactBlockSpec, createReactInlineContentSpec } from '@blocknote/react'
import * as configs from '@/features/editor/core/rich-config'
import * as views from '@/features/editor/ui/rich-views'

export const callout = createReactBlockSpec(configs.calloutConfig, {
  render: views.CalloutView,
})()
export const footnote = createReactBlockSpec(configs.footnoteConfig, {
  render: views.FootnoteView,
})()
export const math = createReactBlockSpec(configs.mathConfig, {
  meta: { code: true },
  render: views.MathEditorView,
})()
export const mermaid = createReactBlockSpec(configs.mermaidConfig, {
  meta: { code: true },
  render: views.MermaidView,
})()
export const toc = createReactBlockSpec(configs.tocConfig, {
  render: views.TocView,
})()
export const linkCard = createReactBlockSpec(configs.linkCardConfig, {
  render: views.LinkCardView,
})()
export const embed = createReactBlockSpec(configs.embedConfig, {
  render: views.EmbedView,
})()
export const citation = createReactInlineContentSpec(configs.citationConfig, {
  render: views.CitationView,
})
export const footnoteRef = createReactInlineContentSpec(configs.footnoteRefConfig, {
  render: views.FootnoteReferenceView,
})
export const inlineMath = createReactInlineContentSpec(configs.inlineMathConfig, {
  render: views.InlineMathView,
})
