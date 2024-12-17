CREATE SCHEMA "zeithrold_blog";
--> statement-breakpoint
CREATE TYPE "zeithrold_blog"."role" AS ENUM('admin', 'editor', 'subscriber');--> statement-breakpoint
CREATE TYPE "zeithrold_blog"."visibility" AS ENUM('public', 'protected', 'private');--> statement-breakpoint
CREATE TABLE "zeithrold_blog"."members" (
	"_incremental_id" serial PRIMARY KEY NOT NULL,
	"id" uuid NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	"user" uuid NOT NULL,
	"role" "zeithrold_blog"."role" NOT NULL,
	CONSTRAINT "members_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "zeithrold_blog"."pages" (
	"_incremental_id" serial PRIMARY KEY NOT NULL,
	"id" uuid NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	"current_version" uuid NOT NULL,
	CONSTRAINT "pages_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "zeithrold_blog"."page_versions" (
	"_incremental_id" serial PRIMARY KEY NOT NULL,
	"id" uuid NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	"visibility" "zeithrold_blog"."visibility" NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"primary_author" uuid NOT NULL,
	"authors" uuid[] NOT NULL,
	"active" boolean NOT NULL,
	CONSTRAINT "page_versions_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "zeithrold_blog"."posts" (
	"_incremental_id" serial PRIMARY KEY NOT NULL,
	"id" uuid NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	"current_version" uuid NOT NULL,
	CONSTRAINT "posts_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "zeithrold_blog"."post_versions" (
	"_incremental_id" serial PRIMARY KEY NOT NULL,
	"id" uuid NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	"visibility" "zeithrold_blog"."visibility" NOT NULL,
	"slug" text NOT NULL,
	"published_at" timestamp NOT NULL,
	"excerpt" text NOT NULL,
	"primary_author" uuid NOT NULL,
	"authors" uuid[] NOT NULL,
	"active" boolean NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"featured" boolean NOT NULL,
	"metadata" jsonb NOT NULL,
	"tags" uuid[] NOT NULL,
	CONSTRAINT "post_versions_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "zeithrold_blog"."tags" (
	"_incremental_id" serial PRIMARY KEY NOT NULL,
	"id" uuid NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	"visibility" "zeithrold_blog"."visibility" NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"metadata" jsonb,
	CONSTRAINT "tags_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "zeithrold_blog"."pages" ADD CONSTRAINT "pages_current_version_page_versions_id_fk" FOREIGN KEY ("current_version") REFERENCES "zeithrold_blog"."page_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeithrold_blog"."posts" ADD CONSTRAINT "posts_current_version_post_versions_id_fk" FOREIGN KEY ("current_version") REFERENCES "zeithrold_blog"."post_versions"("id") ON DELETE no action ON UPDATE no action;