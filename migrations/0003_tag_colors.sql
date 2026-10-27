-- Additive: existing catalog entries retain their neutral appearance.
-- Apply before deploying the color-aware Worker. Keep the column on rollback.
ALTER TABLE catalog ADD COLUMN color TEXT NOT NULL DEFAULT 'neutral'
  CHECK(color IN ('neutral','red','orange','yellow','green','blue','violet','pink'));
