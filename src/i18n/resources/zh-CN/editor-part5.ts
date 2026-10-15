import type { part5 as english } from '@/i18n/resources/en/editor-part5'

export const part5 = {
  slashRichContent: '扩展内容',
  slashCallout: '提示框',
  slashCalloutDescription: '突出显示补充说明、提示或警告',
  slashFootnoteDescription: '添加可在正文中引用的注释',
  slashFormula: '数学公式',
  slashFormulaDescription: '展示独立的数学表达式',
  slashDiagram: '流程图',
  slashDiagramDescription: '使用 Mermaid 绘制流程图',
  slashTableOfContents: '目录',
  slashTableOfContentsDescription: '根据文档标题生成导航目录',
  slashLinkCardDescription: '使用标题和摘要展示链接',
  slashVideoDescription: '在文档中嵌入 YouTube 视频',
} satisfies Record<keyof typeof english, string>
