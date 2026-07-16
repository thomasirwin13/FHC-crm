-- =============================================================================
-- Full-Text Search columns, GIN indexes, and HNSW vector index
-- =============================================================================

-- content_blocks: add tsvector column and GIN index
ALTER TABLE content_blocks ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(category, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_content_blocks_fts ON content_blocks USING GIN (fts);

-- HNSW vector index for approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_content_blocks_vector_hnsw
  ON content_blocks
  USING hnsw (vector extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- organizations: add tsvector column and GIN index
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(website, '') || ' ' ||
      coalesce(type, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_organizations_fts ON organizations USING GIN (fts);

-- contacts: add tsvector column and GIN index
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(email, '') || ' ' ||
      coalesce(background, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_contacts_fts ON contacts USING GIN (fts);

-- Embedding metadata: track which model generated each embedding
ALTER TABLE content_blocks ADD COLUMN IF NOT EXISTS embedding_model TEXT;
ALTER TABLE content_blocks ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;
