-- Home feed covers are published projection data; draft/head covers never reach it.
ALTER TABLE published_documents ADD COLUMN cover_asset_id TEXT REFERENCES assets(id);
ALTER TABLE published_documents ADD COLUMN cover_alt TEXT NOT NULL DEFAULT '';
