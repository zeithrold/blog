import { AuthorList, type AuthorListType, DateInfo, TagList, type TagListType } from '../meta'

export interface ContentTitleProps {
  title: string
  tags?: TagListType
  authors: AuthorListType
  date: Date
}

export default function ContentTitle(
  { title, tags, authors, date }: ContentTitleProps,
) {
  return (
    <div className="flex w-full flex-col gap-8">
      <h1 className="text-4xl font-bold">{title}</h1>
      <div className="flex flex-col gap-4">
        <AuthorList authors={authors} mode="full" />
        <DateInfo date={date} mode="full" />
        <TagList tags={tags} mode="full" />
      </div>
    </div>
  )
}
