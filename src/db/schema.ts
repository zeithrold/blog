import type { ContentVersionMetadata, TagMetadata } from './types'
import process from 'node:process'
import { sql } from 'drizzle-orm'
import {
  boolean,
  jsonb,
  pgSchema,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

export const schema = pgSchema(process.env.POSTGRES_SCHEMA!)

export const role = schema.enum('role', [
  'admin',
  'editor',
  'subscriber',
])

export const visibility = schema.enum('visibility', [
  'public',
  'protected',
  'private',
])

function entityInitializer() {
  return {
    _incremental_id: serial('_incremental_id').primaryKey(),
    id: uuid('id')
      .unique()
      .notNull()
      .$defaultFn(() => sql`gen_random_uuid()`),
    created_at: timestamp('created_at')
      .notNull()
      .$onUpdateFn(() => sql`current_timestamp`),
    updated_at: timestamp('updated_at')
      .notNull()
      .$defaultFn(() => sql`current_timestamp`),
    deleted_at: timestamp('deleted_at'),
  }
}

function contentInitializer() {
  return {
    ...entityInitializer(),
    visibility: visibility('visibility')
      .notNull()
      .$default(() => 'public'),
    slug: text('slug').notNull(),
  }
}

export const member = schema.table('members', {
  ...entityInitializer(),
  user: uuid('user').notNull(),
  role: role('role').notNull().$default(() => 'subscriber'),
})

export const tag = schema.table('tags', {
  ...contentInitializer(),
  name: text('name').notNull(),
  metadata: jsonb('metadata')
    .$type<TagMetadata>()
    .$default(() => ({})),
})

export const pageVersion = schema.table('page_versions', {
  ...contentInitializer(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  metadata: jsonb('metadata')
    .notNull()
    .$type<ContentVersionMetadata>()
    .$default(() => ({})),
  primary_author: uuid('primary_author').notNull(),
  authors: uuid('authors')
    .array()
    .notNull()
    .$default(() => []),
  active: boolean('active').notNull(),
})

export const page = schema.table('pages', {
  ...entityInitializer(),
  current_version: uuid('current_version')
    .references(() => pageVersion.id)
    .notNull(),
})

export const postVersion = schema.table('post_versions', {
  ...contentInitializer(),
  published_at: timestamp('published_at')
    .notNull()
    .$default(() => sql`current_timestamp`),
  excerpt: text('excerpt').notNull(),
  primary_author: uuid('primary_author').notNull(),
  authors: uuid('authors')
    .array()
    .notNull()
    .$default(() => []),
  active: boolean('active').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  featured: boolean('featured')
    .notNull()
    .$default(() => false),
  metadata: jsonb('metadata')
    .notNull()
    .$type<ContentVersionMetadata>()
    .$default(() => ({})),
  tags: uuid('tags')
    .references(() => tag.id)
    .array()
    .notNull()
    .$default(() => []),
})

export const post = schema.table('posts', {
  ...entityInitializer(),
  current_version: uuid('current_version')
    .references(() => postVersion.id)
    .notNull(),
})
