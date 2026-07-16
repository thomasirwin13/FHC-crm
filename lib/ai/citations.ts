import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { Citation } from './types';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function saveCitations(
  teamId: number,
  messageId: number,
  citations: Citation[],
): Promise<void> {
  if (citations.length === 0) return;

  const supabase = adminClient();
  const rows = citations.map((c, i) => ({
    team_id: teamId,
    message_id: messageId,
    source_type: c.sourceType,
    source_id: c.sourceId,
    chunk_id: c.chunkId ?? null,
    source_title: c.sourceTitle ?? null,
    excerpt: c.excerpt ?? null,
    rank: c.rank ?? i + 1,
    similarity_score: c.similarityScore ?? null,
  }));

  const { error } = await supabase.from('ai_citations').insert(rows);
  if (error) {
    console.error('[ai/citations] Failed to save citations:', error.message);
  }
}

export async function getCitationsForMessage(messageId: number): Promise<Citation[]> {
  const supabase = adminClient();
  const { data, error } = await supabase
    .from('ai_citations')
    .select('*')
    .eq('message_id', messageId)
    .order('rank', { ascending: true });

  if (error) {
    console.error('[ai/citations] Failed to fetch citations:', error.message);
    return [];
  }

  return ((data as any[]) ?? []).map((r) => ({
    sourceType: r.source_type,
    sourceId: r.source_id,
    chunkId: r.chunk_id,
    sourceTitle: r.source_title,
    excerpt: r.excerpt,
    rank: r.rank,
    similarityScore: r.similarity_score,
  }));
}

export function searchResultsToCitations(
  results: Array<{
    id: number;
    title?: string | null;
    description?: string | null;
    similarity?: number;
    combinedScore?: number;
  }>,
  sourceType: string,
): Citation[] {
  return results.map((r, i) => ({
    sourceType,
    sourceId: r.id,
    sourceTitle: r.title ?? undefined,
    excerpt: r.description ? r.description.slice(0, 200) : undefined,
    rank: i + 1,
    similarityScore: r.similarity ?? r.combinedScore,
  }));
}
