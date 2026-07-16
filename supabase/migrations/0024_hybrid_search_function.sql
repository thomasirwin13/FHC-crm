-- =============================================================================
-- Hybrid search: vector + full-text with Reciprocal Rank Fusion (RRF)
-- Verifies team membership via auth.uid() before returning results.
-- =============================================================================

-- Drop old function first so we can change the return type
DROP FUNCTION IF EXISTS hybrid_search_blocks(text, integer, integer, double precision, integer);

CREATE FUNCTION hybrid_search_blocks(
  p_query_text text,
  p_query_vector text,
  p_team_id integer,
  p_limit integer DEFAULT 10,
  p_similarity_threshold double precision DEFAULT 0.25,
  p_rrf_k integer DEFAULT 60
)
RETURNS TABLE (
  id integer,
  collection_id integer,
  block_number text,
  category text,
  title text,
  description text,
  similarity double precision,
  fts_rank double precision,
  combined_score double precision,
  match_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  query_vec extensions.vector(1536);
  query_tsquery tsquery;
  caller_user_id integer;
BEGIN
  -- Verify the caller is a member of the requested team
  SELECT u.id INTO caller_user_id
  FROM users u
  JOIN team_members tm ON tm.user_id = u.id
  WHERE u.id = get_app_user_id()
    AND tm.team_id = p_team_id;

  IF caller_user_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: not a member of team %', p_team_id;
  END IF;

  query_vec := p_query_vector::extensions.vector(1536);
  query_tsquery := websearch_to_tsquery('english', p_query_text);

  RETURN QUERY
  WITH vector_results AS (
    SELECT
      cb.id,
      cb.collection_id,
      cb.block_number::text,
      cb.category::text,
      cb.title::text,
      cb.description::text,
      1 - (cb.vector <=> query_vec) AS sim,
      ROW_NUMBER() OVER (ORDER BY cb.vector <=> query_vec) AS vec_rank
    FROM content_blocks cb
    WHERE cb.team_id = p_team_id
      AND cb.vector IS NOT NULL
      AND 1 - (cb.vector <=> query_vec) >= p_similarity_threshold
    ORDER BY cb.vector <=> query_vec
    LIMIT p_limit * 3
  ),
  fts_results AS (
    SELECT
      cb.id,
      cb.collection_id,
      cb.block_number::text,
      cb.category::text,
      cb.title::text,
      cb.description::text,
      ts_rank_cd(cb.fts, query_tsquery) AS rank,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(cb.fts, query_tsquery) DESC) AS fts_rank_num
    FROM content_blocks cb
    WHERE cb.team_id = p_team_id
      AND cb.fts @@ query_tsquery
    ORDER BY ts_rank_cd(cb.fts, query_tsquery) DESC
    LIMIT p_limit * 3
  ),
  combined AS (
    SELECT
      COALESCE(v.id, f.id) AS id,
      COALESCE(v.collection_id, f.collection_id) AS collection_id,
      COALESCE(v.block_number, f.block_number) AS block_number,
      COALESCE(v.category, f.category) AS category,
      COALESCE(v.title, f.title) AS title,
      COALESCE(v.description, f.description) AS description,
      COALESCE(v.sim, 0) AS similarity,
      COALESCE(f.rank, 0) AS fts_rank,
      -- Reciprocal Rank Fusion: 1/(k+rank_vec) + 1/(k+rank_fts)
      COALESCE(1.0 / (p_rrf_k + v.vec_rank), 0) +
        COALESCE(1.0 / (p_rrf_k + f.fts_rank_num), 0) AS combined_score,
      CASE
        WHEN v.id IS NOT NULL AND f.id IS NOT NULL THEN 'hybrid'
        WHEN v.id IS NOT NULL THEN 'vector'
        ELSE 'fts'
      END AS match_type
    FROM vector_results v
    FULL OUTER JOIN fts_results f ON v.id = f.id
  )
  SELECT
    c.id, c.collection_id, c.block_number, c.category,
    c.title, c.description, c.similarity, c.fts_rank,
    c.combined_score, c.match_type
  FROM combined c
  ORDER BY c.combined_score DESC
  LIMIT p_limit;
END;
$$;

ALTER FUNCTION hybrid_search_blocks(text, text, integer, integer, double precision, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION hybrid_search_blocks(text, text, integer, integer, double precision, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hybrid_search_blocks(text, text, integer, integer, double precision, integer) TO authenticated;

-- Also create a simpler FTS-only search for organizations and contacts

CREATE OR REPLACE FUNCTION search_organizations_fts(
  p_query text,
  p_team_id integer,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id integer,
  name text,
  description text,
  website text,
  type text,
  status text,
  rank double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  query_tsquery tsquery;
  caller_user_id integer;
BEGIN
  SELECT u.id INTO caller_user_id
  FROM users u
  JOIN team_members tm ON tm.user_id = u.id
  WHERE u.id = get_app_user_id()
    AND tm.team_id = p_team_id;

  IF caller_user_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: not a member of team %', p_team_id;
  END IF;

  query_tsquery := websearch_to_tsquery('english', p_query);

  RETURN QUERY
  SELECT
    o.id,
    o.name::text,
    o.description::text,
    o.website::text,
    o.type::text,
    o.status::text,
    ts_rank_cd(o.fts, query_tsquery) AS rank
  FROM organizations o
  WHERE o.team_id = p_team_id
    AND o.fts @@ query_tsquery
  ORDER BY ts_rank_cd(o.fts, query_tsquery) DESC
  LIMIT p_limit;
END;
$$;

ALTER FUNCTION search_organizations_fts(text, integer, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION search_organizations_fts(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_organizations_fts(text, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION search_contacts_fts(
  p_query text,
  p_team_id integer,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id integer,
  name text,
  email text,
  phone text,
  organization_id integer,
  rank double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  query_tsquery tsquery;
  caller_user_id integer;
BEGIN
  SELECT u.id INTO caller_user_id
  FROM users u
  JOIN team_members tm ON tm.user_id = u.id
  WHERE u.id = get_app_user_id()
    AND tm.team_id = p_team_id;

  IF caller_user_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: not a member of team %', p_team_id;
  END IF;

  query_tsquery := websearch_to_tsquery('english', p_query);

  RETURN QUERY
  SELECT
    c.id,
    c.name::text,
    c.email::text,
    c.phone::text,
    c.organization_id,
    ts_rank_cd(c.fts, query_tsquery) AS rank
  FROM contacts c
  WHERE c.team_id = p_team_id
    AND c.fts @@ query_tsquery
  ORDER BY ts_rank_cd(c.fts, query_tsquery) DESC
  LIMIT p_limit;
END;
$$;

ALTER FUNCTION search_contacts_fts(text, integer, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION search_contacts_fts(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_contacts_fts(text, integer, integer) TO authenticated;
