export const calloutConfig = {
  type: 'callout',
  propSchema: {
    tone: {
      default: 'info',
      values: [
        'info',
        'warning',
        'success',
        'danger',
      ],
    },
  },
  content: 'inline',
} as const
export const footnoteConfig = {
  type: 'footnote',
  propSchema: {},
  content: 'inline',
} as const
export const mathConfig = {
  type: 'math',
  propSchema: {},
  content: 'plain',
} as const
export const mermaidConfig = {
  type: 'mermaid',
  propSchema: {
    description: {
      default: '',
    },
  },
  content: 'plain',
} as const
export const tocConfig = {
  type: 'toc',
  propSchema: {
    title: {
      default: 'Contents',
    },
  },
  content: 'none',
} as const
export const linkCardConfig = {
  type: 'linkCard',
  propSchema: {
    url: {
      default: '',
    },
    title: {
      default: '',
    },
    description: {
      default: '',
    },
  },
  content: 'none',
} as const
export const embedConfig = {
  type: 'embed',
  propSchema: {
    provider: {
      default: 'youtube',
      values: ['youtube'],
    },
    videoId: {
      default: '',
    },
    title: {
      default: '',
    },
  },
  content: 'none',
} as const
export const citationConfig = {
  type: 'citation',
  propSchema: {
    referenceId: {
      default: '',
    },
    locator: {
      default: '',
    },
  },
  content: 'none',
} as const
export const footnoteRefConfig = {
  type: 'footnoteRef',
  propSchema: {
    noteId: {
      default: '',
    },
  },
  content: 'none',
} as const
export const inlineMathConfig = {
  type: 'inlineMath',
  propSchema: {
    source: {
      default: '',
    },
  },
  content: 'none',
} as const
