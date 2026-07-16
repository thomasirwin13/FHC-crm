import 'server-only';

import type { SearchResult, OrgSearchResult, ContactSearchResult } from './retrieval';
import { hybridSearchBlocks, vectorSearchBlocks, searchOrganizations, searchContacts } from './retrieval';
import { searchResultsToCitations } from './citations';
import { redactFields } from './redaction';
import type { Citation } from './types';

export interface RetrievalContext {
  contentBlocks: Array<{
    source: string;
    title: string | null;
    description: string | null;
    content: string;
    similarity: number;
    matchType: string;
  }>;
  organizations: OrgSearchResult[];
  contacts: ContactSearchResult[];
  citations: Citation[];
}

export async function buildRetrievalContext(
  query: string,
  teamId: number,
  options?: {
    includeOrgs?: boolean;
    includeContacts?: boolean;
    blockLimit?: number;
    useHybrid?: boolean;
  },
): Promise<RetrievalContext> {
  const {
    includeOrgs = false,
    includeContacts = false,
    blockLimit = 10,
    useHybrid = true,
  } = options ?? {};

  const searches: Promise<any>[] = [];

  searches.push(
    useHybrid
      ? hybridSearchBlocks(query, teamId, blockLimit).catch(() => [] as SearchResult[])
      : vectorSearchBlocks(query, teamId, blockLimit).catch(() => [] as SearchResult[]),
  );

  if (includeOrgs) {
    searches.push(searchOrganizations(query, teamId).catch(() => [] as OrgSearchResult[]));
  }
  if (includeContacts) {
    searches.push(searchContacts(query, teamId).catch(() => [] as ContactSearchResult[]));
  }

  const [blocks, orgs, contacts] = await Promise.all(searches);

  const blockResults = (blocks as SearchResult[]) ?? [];
  const orgResults = includeOrgs ? ((orgs as OrgSearchResult[]) ?? []) : [];
  const contactResults = includeContacts ? ((contacts as ContactSearchResult[]) ?? []) : [];

  const citations: Citation[] = [
    ...searchResultsToCitations(blockResults, 'content_block'),
    ...searchResultsToCitations(
      orgResults.map((o) => ({ id: o.id, title: o.name, description: o.description, similarity: o.rank })),
      'organization',
    ),
    ...searchResultsToCitations(
      contactResults.map((c) => ({ id: c.id, title: c.name, description: c.email, similarity: c.rank })),
      'contact',
    ),
  ];

  const contentBlocks = blockResults.map((r) => ({
    source: 'content_blocks',
    title: r.title,
    description: r.description,
    content: `${r.title ?? ''}: ${r.description ?? ''}`.trim(),
    similarity: r.combinedScore,
    matchType: r.matchType,
  }));

  return {
    contentBlocks,
    organizations: orgResults.map((o) => redactFields(o as unknown as Record<string, unknown>) as unknown as OrgSearchResult),
    contacts: contactResults.map((c) => redactFields(c as unknown as Record<string, unknown>) as unknown as ContactSearchResult),
    citations,
  };
}

export function formatContextForPrompt(ctx: RetrievalContext): string {
  const parts: string[] = [];

  if (ctx.contentBlocks.length > 0) {
    parts.push('## Knowledge Base Results');
    for (const block of ctx.contentBlocks) {
      parts.push(`- **${block.title ?? 'Untitled'}** (${block.matchType}, score: ${block.similarity.toFixed(3)})`);
      if (block.description) {
        parts.push(`  ${block.description}`);
      }
    }
  }

  if (ctx.organizations.length > 0) {
    parts.push('\n## Matching Organizations');
    for (const org of ctx.organizations.slice(0, 5)) {
      parts.push(`- **${org.name}** (${org.type ?? 'unknown type'}, ${org.status ?? 'unknown status'})`);
      if (org.description) parts.push(`  ${org.description}`);
    }
  }

  if (ctx.contacts.length > 0) {
    parts.push('\n## Matching Contacts');
    for (const c of ctx.contacts.slice(0, 5)) {
      parts.push(`- **${c.name}**${c.email ? ` (${c.email})` : ''}`);
    }
  }

  return parts.join('\n');
}
