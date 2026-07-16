import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { generateEmbedding } from './embeddings';

export interface SearchResult {
  id: number;
  collectionId: number;
  blockNumber: string | null;
  category: string | null;
  title: string | null;
  description: string | null;
  similarity: number;
  ftsRank: number;
  combinedScore: number;
  matchType: 'hybrid' | 'vector' | 'fts';
}

export interface OrgSearchResult {
  id: number;
  name: string;
  description: string | null;
  website: string | null;
  type: string | null;
  status: string | null;
  rank: number;
}

export interface ContactSearchResult {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  organizationId: number | null;
  rank: number;
}

export async function hybridSearchBlocks(
  query: string,
  teamId: number,
  limit = 10,
  similarityThreshold = 0.25,
): Promise<SearchResult[]> {
  const embedding = await generateEmbedding(query);
  const vectorString = `[${embedding.join(',')}]`;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('hybrid_search_blocks', {
    p_query_text: query,
    p_query_vector: vectorString,
    p_team_id: teamId,
    p_limit: limit,
    p_similarity_threshold: similarityThreshold,
    p_rrf_k: 60,
  });

  if (error) {
    console.error('[ai/retrieval] hybrid_search_blocks failed:', error.message);
    return [];
  }

  return ((data as any[]) ?? []).map((r) => ({
    id: r.id,
    collectionId: r.collection_id,
    blockNumber: r.block_number,
    category: r.category,
    title: r.title,
    description: r.description,
    similarity: r.similarity,
    ftsRank: r.fts_rank,
    combinedScore: r.combined_score,
    matchType: r.match_type as SearchResult['matchType'],
  }));
}

export async function vectorSearchBlocks(
  query: string,
  teamId: number,
  limit = 10,
  similarityThreshold = 0.35,
): Promise<SearchResult[]> {
  const embedding = await generateEmbedding(query);
  const vectorString = `[${embedding.join(',')}]`;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('search_similar_blocks', {
    p_query_vector: vectorString,
    p_team_id: teamId,
    p_limit: limit,
  });

  if (error) {
    console.error('[ai/retrieval] search_similar_blocks failed:', error.message);
    return [];
  }

  return ((data as any[]) ?? [])
    .filter((r) => (r.similarity ?? 0) >= similarityThreshold)
    .map((r) => ({
      id: r.id,
      collectionId: r.collection_id,
      blockNumber: r.block_number,
      category: r.category,
      title: r.title,
      description: r.description,
      similarity: r.similarity,
      ftsRank: 0,
      combinedScore: r.similarity,
      matchType: 'vector' as const,
    }));
}

export async function searchOrganizations(
  query: string,
  teamId: number,
  limit = 20,
): Promise<OrgSearchResult[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('search_organizations_fts', {
    p_query: query,
    p_team_id: teamId,
    p_limit: limit,
  });

  if (error) {
    console.error('[ai/retrieval] search_organizations_fts failed:', error.message);
    return [];
  }

  return ((data as any[]) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    website: r.website,
    type: r.type,
    status: r.status,
    rank: r.rank,
  }));
}

export async function searchContacts(
  query: string,
  teamId: number,
  limit = 20,
): Promise<ContactSearchResult[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('search_contacts_fts', {
    p_query: query,
    p_team_id: teamId,
    p_limit: limit,
  });

  if (error) {
    console.error('[ai/retrieval] search_contacts_fts failed:', error.message);
    return [];
  }

  return ((data as any[]) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    organizationId: r.organization_id,
    rank: r.rank,
  }));
}
