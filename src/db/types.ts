export interface PlainTextMetadata {
  title?: string
  description?: string
}

export interface MultiMediaMetadata extends PlainTextMetadata {
  image?: string
}

export interface ContentVersionMetadata {
  html?: PlainTextMetadata
  og?: MultiMediaMetadata
  twitter?: MultiMediaMetadata
  code_inject?: ContentVersionCodeInject
}

export interface ContentVersionCodeInject {
  head?: string
  foot?: string
}

export interface TagMetadata {
  description?: string
  image?: string
  color?: string
}
