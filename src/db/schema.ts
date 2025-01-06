import type { ContentVersionMetadata, TagMetadata } from './types'
import { sql } from 'drizzle-orm'
import {
  boolean,
  jsonb,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import {
  initEntity,
  schema,
} from './common'

export {
  schema,
}

export const typeEnums = ['post', 'page'] as const

export const type = schema.enum('type', typeEnums)

export const visibilityEnums = ['public', 'unlisted', 'protected', 'private'] as const

export const visibility = schema.enum('visibility', visibilityEnums)

export const tag = schema.table('tags', {
  ...initEntity(),
  /**
   * Name of the tag
   */
  name: text('name').notNull(),
  /**
   * Slug for the tag, used for SEO and URL
   */
  slug: text('slug').notNull(),
  /**
   * Metadata for the tag
   */
  metadata: jsonb('metadata')
    .notNull()
    .$default(() => ({}))
    .$type<TagMetadata>(),
})

export const content = schema.table('contents', {
  ...initEntity(),
  /**
   * Collection id for the content, used for version control
   */
  collection: uuid('collection')
    .notNull()
    .$default(() => sql`gen_random_uuid()`),
  /**
   * Type of the content
   */
  type: type('type').notNull(),
  /**
   * Visibility of the content, consists of public, unlisted, protected, private
   */
  visibility: visibility('visibility')
    .notNull()
    .$default(() => 'public'),
  /**
   * Slug for the content, used for SEO and URL
   */
  slug: text('slug').notNull(),
  /**
   * Timestamps for each content when it was published.
   * If the content is not published, it will be null.
   *
   * This field is also used for scheduling the content to be published in the future.
   */
  publishedAt: timestamp('published_at')
    .notNull()
    .$default(() => sql`current_timestamp`),
  /**
   * Primary author of the content
   */
  primaryAuthor: uuid('primary_author')
    .notNull(),
  /**
   * Authors of the content
   */
  authors: uuid('authors')
    .array()
    .notNull()
    .$default(() => []),
  /**
   * Excerpt of the content
   */
  excerpt: text('excerpt'),
  /**
   * Title of the content
   */
  title: text('title')
    .notNull(),
  /**
   * Content written in markdown
   */
  content: text('content')
    .notNull(),
  /**
   * Content generated in HTML
   */
  contentHtml: text('content_html')
    .notNull(),
  /**
   * Content generated in plain text
   */
  contentPlainText: text('content_plaintext')
    .notNull(),
  /**
   * Whether the content is current version of a content
   * If it is not the current version, it will be false
   */
  active: boolean('active').notNull(),
  /**
   * Metadata for the content
   */
  metadata: jsonb('metadata')
    .notNull()
    .$type<ContentVersionMetadata>()
    .$default(() => ({})),
  /**
   * Tags for the content
   */
  tags: uuid('tags')
    .references(() => tag.id)
    .array()
    .notNull()
    .$default(() => []),
})

export const role = schema.enum('role', [
  'admin',
  'editor',
  'subscriber',
])

export const user = schema.table('users', {
  ...initEntity(),
  /**
   * Supabase's UUID for the member
   */
  supabase: uuid('supabase')
    .notNull(),
  /**
   * Displayed name of the member
   */
  name: text('name').notNull(),
  /**
   * Email of the member
   */
  email: text('email').notNull(),
  /**
   * bio of the member
   */
  bio: text('bio'),
  /**
   * Role of the member
   */
  role: role('role')
    .notNull()
    .$default(() => 'subscriber'),
})
