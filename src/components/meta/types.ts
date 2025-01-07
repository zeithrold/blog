export interface Author {
  name: string
  username: string
  avatar: string
}

export interface Tag {
  name: string
  slug: string
  color?: string
}

export type AuthorListType = [Author] | [Author, Author] | [Author, Author, ...Author[]]
export type TagListType = Tag[]
