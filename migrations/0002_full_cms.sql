ALTER TABLE site_state ADD COLUMN content_bytes INTEGER NOT NULL DEFAULT 0 CHECK(content_bytes>=0);
ALTER TABLE site_state ADD COLUMN maintenance_owner TEXT;
ALTER TABLE site_state ADD COLUMN maintenance_since INTEGER;
UPDATE site_state SET content_bytes=(SELECT COALESCE(SUM(canonical_bytes),0) FROM revisions);
CREATE TRIGGER revision_storage AFTER INSERT ON revisions BEGIN
  UPDATE site_state SET content_bytes=content_bytes+NEW.canonical_bytes WHERE id=1;
END;
CREATE TRIGGER revision_capacity BEFORE INSERT ON revisions WHEN
  (SELECT content_bytes+NEW.canonical_bytes>8589934592 FROM site_state WHERE id=1)
  BEGIN SELECT RAISE(ABORT,'STORAGE_LIMIT'); END;

CREATE TABLE assets (
  id TEXT PRIMARY KEY CHECK(length(id)=36), object_key TEXT NOT NULL UNIQUE,
  owner_sub TEXT NOT NULL, filename TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('image','audio','video','file','caption','poster')),
  type TEXT NOT NULL, declared_bytes INTEGER NOT NULL CHECK(declared_bytes BETWEEN 1 AND 67108864),
  sha256 TEXT NOT NULL CHECK(length(sha256)=64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
  state TEXT NOT NULL CHECK(state IN ('uploading','ready','rejected','deleting','deleted')),
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, ready_at INTEGER, upload_claim TEXT,
  bytes INTEGER, width INTEGER, height INTEGER, gc_after INTEGER,
  CHECK(state!='ready' OR (bytes=declared_bytes AND ready_at IS NOT NULL))
);
CREATE INDEX assets_gc ON assets(state,gc_after,expires_at);
CREATE INDEX assets_owner_created ON assets(owner_sub,created_at DESC);
CREATE TRIGGER asset_descriptor_immutable BEFORE UPDATE ON assets WHEN
  NEW.object_key!=OLD.object_key OR NEW.owner_sub!=OLD.owner_sub OR NEW.filename!=OLD.filename OR
  NEW.role!=OLD.role OR NEW.type!=OLD.type OR NEW.declared_bytes!=OLD.declared_bytes OR NEW.sha256!=OLD.sha256
BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ASSET_DESCRIPTOR'); END;
CREATE TRIGGER asset_state_transition BEFORE UPDATE ON assets WHEN NOT (
  (OLD.state='uploading' AND NEW.state IN ('uploading','ready','rejected')) OR
  (OLD.state='ready' AND NEW.state IN ('ready','deleting')) OR
  (OLD.state='rejected' AND NEW.state IN ('rejected','deleting')) OR
  (OLD.state='deleting' AND NEW.state IN ('deleting','deleted')) OR
  (OLD.state='deleted' AND NEW.state='deleted')
) BEGIN SELECT RAISE(ABORT,'ASSET_STATE_CONFLICT'); END;
CREATE TRIGGER asset_ready_immutable BEFORE UPDATE ON assets WHEN OLD.state='ready' AND
  (NEW.bytes IS NOT OLD.bytes OR NEW.width IS NOT OLD.width OR NEW.height IS NOT OLD.height OR NEW.ready_at IS NOT OLD.ready_at)
  BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ASSET_CONTENT'); END;
CREATE TABLE revision_assets (
  revision_id TEXT NOT NULL REFERENCES revisions(id), asset_id TEXT NOT NULL REFERENCES assets(id),
  role TEXT NOT NULL CHECK(role IN ('image','audio','video','file','caption','poster')),
  PRIMARY KEY(revision_id,asset_id,role)
);
CREATE INDEX asset_history_refs ON revision_assets(asset_id);
CREATE TRIGGER revision_asset_ready BEFORE INSERT ON revision_assets BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM assets WHERE id=NEW.asset_id AND state='ready' AND
    (role=NEW.role OR (NEW.role='poster' AND role='image')))
    THEN RAISE(ABORT,'ASSET_NOT_READY') END;
END;
CREATE TRIGGER revision_asset_no_update BEFORE UPDATE ON revision_assets BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ASSET_REF'); END;
CREATE TRIGGER revision_asset_no_delete BEFORE DELETE ON revision_assets BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ASSET_REF'); END;
CREATE TRIGGER asset_referenced_guard BEFORE UPDATE OF state ON assets
  WHEN NEW.state!='ready' AND EXISTS(SELECT 1 FROM revision_assets WHERE asset_id=OLD.id)
  BEGIN SELECT RAISE(ABORT,'ASSET_REFERENCED'); END;

CREATE TABLE catalog (
  id TEXT PRIMARY KEY CHECK(length(id)=36), kind TEXT NOT NULL CHECK(kind IN ('tag','series')),
  slug TEXT NOT NULL, label TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0,
  retired INTEGER NOT NULL DEFAULT 0 CHECK(retired IN (0,1)), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  UNIQUE(kind,slug), UNIQUE(id,kind)
);
CREATE TABLE revision_catalog (
  revision_id TEXT NOT NULL REFERENCES revisions(id), catalog_id TEXT NOT NULL REFERENCES catalog(id),
  kind TEXT NOT NULL CHECK(kind IN ('tag','series')), position INTEGER,
  PRIMARY KEY(revision_id,catalog_id), FOREIGN KEY(catalog_id,kind) REFERENCES catalog(id,kind),
  CHECK((kind='tag' AND position IS NULL) OR (kind='series' AND position BETWEEN 0 AND 100000))
);
CREATE TRIGGER revision_catalog_no_update BEFORE UPDATE ON revision_catalog BEGIN SELECT RAISE(ABORT,'IMMUTABLE_CATALOG_REF'); END;
CREATE TRIGGER revision_catalog_no_delete BEFORE DELETE ON revision_catalog BEGIN SELECT RAISE(ABORT,'IMMUTABLE_CATALOG_REF'); END;
CREATE TABLE published_catalog (
  document_id TEXT NOT NULL REFERENCES documents(id), catalog_id TEXT NOT NULL REFERENCES catalog(id),
  kind TEXT NOT NULL CHECK(kind IN ('tag','series')), slug TEXT NOT NULL, label TEXT NOT NULL, position INTEGER,
  PRIMARY KEY(document_id,catalog_id), FOREIGN KEY(catalog_id,kind) REFERENCES catalog(id,kind)
);
CREATE UNIQUE INDEX published_series_position ON published_catalog(catalog_id,position) WHERE kind='series';
CREATE INDEX published_catalog_routes ON published_catalog(kind,slug,position,document_id);

CREATE TABLE schedules (
  id TEXT PRIMARY KEY CHECK(length(id)=36), document_id TEXT NOT NULL REFERENCES documents(id),
  revision_id TEXT NOT NULL, expected_live_generation INTEGER NOT NULL CHECK(expected_live_generation>=0),
  run_at INTEGER NOT NULL, local_time TEXT NOT NULL, timezone TEXT NOT NULL, utc_offset INTEGER NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending','done','cancelled','failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 8), next_attempt_at INTEGER NOT NULL,
  error_code TEXT, actor_sub TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  FOREIGN KEY(document_id,revision_id) REFERENCES revisions(document_id,id)
);
CREATE INDEX schedules_due ON schedules(state,next_attempt_at,run_at,id);
CREATE INDEX schedules_document ON schedules(document_id,created_at DESC);
CREATE UNIQUE INDEX schedules_one_pending ON schedules(document_id) WHERE state='pending';
CREATE TABLE backup_runs (
  id TEXT PRIMARY KEY CHECK(length(id)=36), state TEXT NOT NULL CHECK(state IN ('frozen','complete','failed')),
  actor_sub TEXT NOT NULL, epoch INTEGER NOT NULL, created_at INTEGER NOT NULL, completed_at INTEGER, manifest_sha256 TEXT
);
CREATE TABLE backup_assets (
  backup_id TEXT NOT NULL REFERENCES backup_runs(id), asset_id TEXT NOT NULL REFERENCES assets(id), PRIMARY KEY(backup_id,asset_id)
);
CREATE TRIGGER backup_asset_guard BEFORE UPDATE OF state ON assets WHEN NEW.state='deleting' AND
  EXISTS(SELECT 1 FROM backup_assets ba JOIN backup_runs b ON b.id=ba.backup_id WHERE ba.asset_id=OLD.id AND b.state='frozen')
  BEGIN SELECT RAISE(ABORT,'ASSET_BACKUP_PINNED'); END;
