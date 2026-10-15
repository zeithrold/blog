-- Fresh local rebuild. Assets, taxonomy and scheduling are later additive migrations.
CREATE TABLE site_state (
  id INTEGER PRIMARY KEY CHECK(id=1), public_generation INTEGER NOT NULL DEFAULT 0 CHECK(public_generation>=0),
  maintenance INTEGER NOT NULL DEFAULT 0 CHECK(maintenance IN (0,1))
);
INSERT INTO site_state(id) VALUES(1);
CREATE TABLE documents (
  id TEXT PRIMARY KEY CHECK(length(id)=36), kind TEXT NOT NULL CHECK(kind IN ('article','page')),
  head_revision_id TEXT, live_revision_id TEXT, version INTEGER NOT NULL DEFAULT 0 CHECK(version>=0),
  live_generation INTEGER NOT NULL DEFAULT 0 CHECK(live_generation>=0),
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, first_published_at INTEGER, last_published_at INTEGER, deleted_at INTEGER,
  FOREIGN KEY(id,head_revision_id) REFERENCES revisions(document_id,id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY(id,live_revision_id) REFERENCES revisions(document_id,id) DEFERRABLE INITIALLY DEFERRED,
  CHECK(deleted_at IS NULL OR live_revision_id IS NULL)
);
CREATE INDEX documents_updated ON documents(deleted_at,updated_at DESC,id);
CREATE TABLE revisions (
  id TEXT PRIMARY KEY CHECK(length(id)=36), document_id TEXT NOT NULL REFERENCES documents(id),
  sequence INTEGER NOT NULL CHECK(sequence>0), parent_revision_id TEXT, restored_from_id TEXT,
  schema_version INTEGER NOT NULL CHECK(schema_version=1), canonical_json TEXT NOT NULL CHECK(json_valid(canonical_json)),
  content_sha256 TEXT NOT NULL CHECK(length(content_sha256)=64 AND content_sha256 NOT GLOB '*[^0-9a-f]*'),
  canonical_bytes INTEGER NOT NULL CHECK(canonical_bytes BETWEEN 1 AND 524288),
  reason TEXT NOT NULL CHECK(reason IN ('create','autosave','manual','restore','migration')), actor_sub TEXT NOT NULL, created_at INTEGER NOT NULL,
  UNIQUE(document_id,id), UNIQUE(document_id,sequence),
  FOREIGN KEY(document_id,parent_revision_id) REFERENCES revisions(document_id,id),
  FOREIGN KEY(document_id,restored_from_id) REFERENCES revisions(document_id,id),
  CHECK(json_extract(canonical_json,'$.schemaVersion') IS schema_version),
  CHECK(json_extract(canonical_json,'$.format') IS 'blocknote'),
  CHECK(json_extract(canonical_json,'$.blockSchema') IS 'blog-blocknote-v1'),
  CHECK(json_type(canonical_json,'$.blocks') IS 'array'),
  CHECK(length(CAST(canonical_json AS BLOB))=canonical_bytes)
);
CREATE INDEX revisions_history ON revisions(document_id,sequence DESC);
CREATE TRIGGER revisions_no_update BEFORE UPDATE ON revisions BEGIN SELECT RAISE(ABORT,'IMMUTABLE_REVISION'); END;
CREATE TRIGGER revisions_no_delete BEFORE DELETE ON revisions BEGIN SELECT RAISE(ABORT,'IMMUTABLE_REVISION'); END;
CREATE TABLE mutations (
  request_id TEXT PRIMARY KEY, document_id TEXT REFERENCES documents(id), operation TEXT NOT NULL,
  request_sha256 TEXT NOT NULL CHECK(length(request_sha256)=64), response_json TEXT NOT NULL CHECK(json_valid(response_json)), committed_at INTEGER NOT NULL
);
CREATE TABLE txn_guards (id TEXT PRIMARY KEY, ok INTEGER NOT NULL CONSTRAINT guard_ok CHECK(ok=1));
CREATE TABLE publication_events (
  id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id), operation TEXT NOT NULL CHECK(operation IN ('publish','unpublish')),
  revision_id TEXT, live_generation INTEGER NOT NULL, actor_sub TEXT NOT NULL, happened_at INTEGER NOT NULL,
  FOREIGN KEY(document_id,revision_id) REFERENCES revisions(document_id,id), UNIQUE(document_id,live_generation)
);
CREATE TABLE published_documents (
  row_id INTEGER PRIMARY KEY, document_id TEXT NOT NULL UNIQUE REFERENCES documents(id), revision_id TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE, kind TEXT NOT NULL CHECK(kind IN ('article','page')),
  title TEXT NOT NULL, description TEXT NOT NULL, document_locale TEXT NOT NULL, plain_text TEXT NOT NULL, cjk_bigrams TEXT NOT NULL,
  published_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, searchable INTEGER NOT NULL CHECK(searchable IN (0,1)),
  FOREIGN KEY(document_id,revision_id) REFERENCES revisions(document_id,id)
);
CREATE INDEX published_list ON published_documents(kind,published_at DESC,document_id);
CREATE TRIGGER projection_matches_live BEFORE INSERT ON published_documents BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM documents WHERE id=NEW.document_id AND live_revision_id=NEW.revision_id AND kind=NEW.kind AND deleted_at IS NULL)
    THEN RAISE(ABORT,'LIVE_PROJECTION_MISMATCH') END;
END;
CREATE TRIGGER projection_update_matches_live BEFORE UPDATE ON published_documents BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM documents WHERE id=NEW.document_id AND live_revision_id=NEW.revision_id AND kind=NEW.kind AND deleted_at IS NULL)
    THEN RAISE(ABORT,'LIVE_PROJECTION_MISMATCH') END;
END;
CREATE VIEW published_search_content AS SELECT row_id,title,plain_text,cjk_bigrams FROM published_documents WHERE searchable=1;
CREATE VIRTUAL TABLE search_lexical USING fts5(title,plain_text,cjk_bigrams,content='published_search_content',content_rowid='row_id',tokenize="unicode61 tokenchars '_'");
CREATE TRIGGER public_insert AFTER INSERT ON published_documents BEGIN
  INSERT INTO search_lexical(rowid,title,plain_text,cjk_bigrams) SELECT NEW.row_id,NEW.title,NEW.plain_text,NEW.cjk_bigrams WHERE NEW.searchable=1;
END;
CREATE TRIGGER public_delete AFTER DELETE ON published_documents BEGIN
  INSERT INTO search_lexical(search_lexical,rowid,title,plain_text,cjk_bigrams) SELECT 'delete',OLD.row_id,OLD.title,OLD.plain_text,OLD.cjk_bigrams WHERE OLD.searchable=1;
END;
CREATE TRIGGER public_update AFTER UPDATE ON published_documents BEGIN
  INSERT INTO search_lexical(search_lexical,rowid,title,plain_text,cjk_bigrams) SELECT 'delete',OLD.row_id,OLD.title,OLD.plain_text,OLD.cjk_bigrams WHERE OLD.searchable=1;
  INSERT INTO search_lexical(rowid,title,plain_text,cjk_bigrams) SELECT NEW.row_id,NEW.title,NEW.plain_text,NEW.cjk_bigrams WHERE NEW.searchable=1;
END;
