import type { AuthorListType, TagListType } from './meta'

export interface ArticleCardProps {
  title: string
  content: string
  authors: AuthorListType
  slug: string
  date: Date
  image?: string
  tags?: TagListType
  featured?: boolean
}
