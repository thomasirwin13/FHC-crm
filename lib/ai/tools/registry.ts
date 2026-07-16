import 'server-only';

import { tool } from 'ai';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getOrganizationsForTeam } from '@/lib/db/supabase-queries';
import { findRelevantContent } from '@/lib/ai/embeddings';
import { ORGANIZATION_STATUSES, DEFAULT_ORGANIZATION_STATUS, organizationStatusSchema } from '@/lib/constants/organization';
import { resourceTypeSchema } from '@/lib/constants/resource';
import { searchOrganizations, searchContacts } from '@/lib/ai/retrieval';

interface ToolContext {
  teamId: number;
  onToolCall?: () => void;
}

export function createReadTools(ctx: ToolContext) {
  const { teamId, onToolCall } = ctx;

  return {
    getInformation: tool({
      description: `get information from your knowledge base to answer questions.`,
      inputSchema: z.object({
        question: z.string().describe('the users question'),
      }),
      execute: async ({ question }) => {
        onToolCall?.();
        return findRelevantContent(question, teamId);
      },
    }),

    listCollections: tool({
      description: `List all collections in the user's library. Use when asked about collections, content catalog, or what collections they have. Returns collection details including deep link URLs - always include clickable links to collections in your response.`,
      inputSchema: z.object({}),
      execute: async () => {
        onToolCall?.();
        const supabase = await createClient();
        const { data: collections } = await supabase
          .from('collections')
          .select('id, name, description, owner')
          .eq('team_id', teamId)
          .order('name');

        return {
          collections: collections?.map(c => ({
            id: c.id,
            name: c.name,
            description: c.description || 'No description',
            owner: c.owner,
            url: `/app/library/collections/${c.id}`,
          })) || [],
          count: collections?.length || 0,
        };
      },
    }),

    browseBlocks: tool({
      description: `Browse all content blocks for a collection. Use when user wants to see all blocks, explore capabilities, or get a complete overview. Can also filter by category.`,
      inputSchema: z.object({
        collectionName: z.string().optional().describe('Name of the collection to browse blocks for'),
        collectionId: z.number().optional().describe('ID of the collection to browse blocks for'),
        category: z.string().optional().describe('Optional category to filter blocks by'),
        limit: z.number().optional().default(50).describe('Maximum number of blocks to return'),
      }),
      execute: async ({ collectionName, collectionId, category, limit = 50 }) => {
        onToolCall?.();
        const supabase = await createClient();

        let resolvedCollectionId = collectionId;
        if (!resolvedCollectionId && collectionName) {
          const { data: collection } = await supabase
            .from('collections')
            .select('id')
            .eq('team_id', teamId)
            .ilike('name', `%${collectionName}%`)
            .single();
          resolvedCollectionId = collection?.id;
        }

        let query = supabase
          .from('content_blocks')
          .select('id, block_number, category, title, description, collection_id, collections!inner(name)')
          .eq('team_id', teamId)
          .order('category')
          .order('block_number')
          .limit(limit);

        if (resolvedCollectionId) {
          query = query.eq('collection_id', resolvedCollectionId);
        }
        if (category) {
          query = query.ilike('category', `%${category}%`);
        }

        const { data: blocks } = await query;

        const byCategory: Record<string, any[]> = {};
        for (const b of blocks || []) {
          const cat = b.category || 'Uncategorized';
          if (!byCategory[cat]) byCategory[cat] = [];
          byCategory[cat].push({
            id: b.id,
            number: b.block_number,
            name: b.title,
            description: b.description,
            collection: (b.collections as any)?.name,
          });
        }

        return { blocks: byCategory, totalCount: blocks?.length || 0, collectionId: resolvedCollectionId };
      },
    }),

    getAppLinks: tool({
      description: `Get navigation links to app pages. Use when user asks how to navigate, where to find something, or wants to go to a specific page.`,
      inputSchema: z.object({
        linkType: z.enum(['organizations', 'collections', 'blocks', 'chat', 'all']).describe('Type of link to return'),
      }),
      execute: async ({ linkType }) => {
        onToolCall?.();
        const links: Record<string, { url: string; title: string; description: string }> = {
          organizations: { url: '/app/organizations', title: 'Organizations', description: 'Manage organizations and accounts' },
          collections: { url: '/app/library/collections', title: 'Collections', description: 'Manage content collections' },
          blocks: { url: '/app/library/blocks', title: 'Blocks', description: 'Browse content blocks' },
          chat: { url: '/app/chat', title: 'Chat', description: 'AI sales engineer chat' },
        };

        if (linkType === 'all') {
          return { links: Object.entries(links).map(([key, link]) => ({ type: key, ...link, markdown: `[${link.title}](${link.url})` })) };
        }
        const link = links[linkType];
        return { link: { type: linkType, ...link, markdown: `[${link.title}](${link.url})` } };
      },
    }),

    listOrganizations: tool({
      description: `List all organizations/accounts for the user's team. Use when asked about organizations, clients, prospects, or accounts.`,
      inputSchema: z.object({}),
      execute: async () => {
        onToolCall?.();
        const organizations = await getOrganizationsForTeam(teamId);
        return {
          organizations: organizations.map((c: any) => ({
            id: c.id, name: c.name, status: c.status, type: c.type, website: c.website,
            url: `/app/organizations/${c.id}`,
          })),
          count: organizations.length,
        };
      },
    }),

    searchCRM: tool({
      description: `Search organizations and contacts by name, email, or other text. Use for finding specific records across the CRM.`,
      inputSchema: z.object({
        query: z.string().describe('Search query'),
        searchType: z.enum(['organizations', 'contacts', 'both']).default('both').describe('What to search'),
      }),
      execute: async ({ query, searchType }) => {
        onToolCall?.();
        const results: any = {};

        if (searchType === 'organizations' || searchType === 'both') {
          results.organizations = await searchOrganizations(query, teamId);
        }
        if (searchType === 'contacts' || searchType === 'both') {
          results.contacts = await searchContacts(query, teamId);
        }

        return results;
      },
    }),
  };
}

export function createWriteTools(ctx: ToolContext) {
  const { teamId, onToolCall } = ctx;

  return {
    editCollection: tool({
      description: `Edit a collection's details like name, owner, or description. Returns a preview that requires user confirmation before saving.`,
      inputSchema: z.object({
        collectionId: z.number().optional(),
        collectionName: z.string().optional(),
        newName: z.string().optional(),
        newOwner: z.string().optional(),
        newDescription: z.string().optional(),
      }),
      execute: async ({ collectionId, collectionName, newName, newOwner, newDescription }) => {
        onToolCall?.();
        const supabase = await createClient();
        let resolvedId = collectionId;
        let currentCollection = null;

        if (resolvedId) {
          const { data } = await supabase.from('collections').select('id, name, owner, description').eq('id', resolvedId).eq('team_id', teamId).single();
          currentCollection = data;
        } else if (collectionName) {
          const { data } = await supabase.from('collections').select('id, name, owner, description').eq('team_id', teamId).ilike('name', `%${collectionName}%`).single();
          currentCollection = data;
          resolvedId = data?.id;
        }

        if (!currentCollection || !resolvedId) return { error: true, message: 'Collection not found.' };
        if (!newName && !newOwner && !newDescription) return { error: true, message: 'No changes specified.' };

        return {
          needsConfirmation: true, confirmationType: 'edit_collection', confirmationId: crypto.randomUUID(),
          collectionId: resolvedId, collectionName: currentCollection.name,
          preview: { newName: newName || undefined, newOwner: newOwner || undefined, newDescription: newDescription || undefined },
          currentValues: { name: currentCollection.name, owner: currentCollection.owner, description: currentCollection.description },
        };
      },
    }),

    addCollectionResource: tool({
      description: `Add a resource link to a collection. Returns a preview that requires user confirmation.`,
      inputSchema: z.object({
        collectionId: z.number().optional(),
        collectionName: z.string().optional(),
        label: z.string(),
        url: z.string(),
        type: resourceTypeSchema.default('other'),
      }),
      execute: async ({ collectionId, collectionName, label, url, type }) => {
        onToolCall?.();
        const supabase = await createClient();
        let resolvedId = collectionId;
        let resolvedName = collectionName;

        if (resolvedId) {
          const { data } = await supabase.from('collections').select('id, name').eq('id', resolvedId).eq('team_id', teamId).single();
          resolvedName = data?.name;
        } else if (collectionName) {
          const { data } = await supabase.from('collections').select('id, name').eq('team_id', teamId).ilike('name', `%${collectionName}%`).single();
          resolvedId = data?.id;
          resolvedName = data?.name;
        }
        if (!resolvedId) return { error: true, message: 'Collection not found.' };

        return {
          needsConfirmation: true, confirmationType: 'add_resource', confirmationId: crypto.randomUUID(),
          collectionId: resolvedId, collectionName: resolvedName,
          preview: { label, url, type },
        };
      },
    }),

    addBlock: tool({
      description: `Add a new content block to a collection. Returns a preview that requires user confirmation.`,
      inputSchema: z.object({
        collectionId: z.number().optional(),
        collectionName: z.string().optional(),
        title: z.string(),
        category: z.string().optional(),
        description: z.string().optional(),
      }),
      execute: async ({ collectionId, collectionName, title, category, description }) => {
        onToolCall?.();
        const supabase = await createClient();
        let resolvedId = collectionId;
        let resolvedName = collectionName;

        if (resolvedId) {
          const { data } = await supabase.from('collections').select('id, name').eq('id', resolvedId).eq('team_id', teamId).single();
          resolvedName = data?.name;
        } else if (collectionName) {
          const { data } = await supabase.from('collections').select('id, name').eq('team_id', teamId).ilike('name', `%${collectionName}%`).single();
          resolvedId = data?.id;
          resolvedName = data?.name;
        }
        if (!resolvedId) return { error: true, message: 'Collection not found.' };

        return {
          needsConfirmation: true, confirmationType: 'add_block', confirmationId: crypto.randomUUID(),
          collectionId: resolvedId, collectionName: resolvedName,
          preview: { title, category, description },
        };
      },
    }),

    editBlock: tool({
      description: `Edit an existing content block. Use browseBlocks first to find the block ID. Returns a preview that requires user confirmation.`,
      inputSchema: z.object({
        blockId: z.number(),
        category: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
      }),
      execute: async ({ blockId, category, title, description }) => {
        onToolCall?.();
        const supabase = await createClient();
        const { data: currentBlock } = await supabase
          .from('content_blocks')
          .select('id, category, title, description, collection_id, collections!inner(name)')
          .eq('id', blockId).eq('team_id', teamId).single();

        if (!currentBlock) return { error: true, message: 'Block not found.' };
        if (!category && !title && !description) return { error: true, message: 'No changes specified.' };

        return {
          needsConfirmation: true, confirmationType: 'edit_block', confirmationId: crypto.randomUUID(),
          blockId: currentBlock.id, collectionId: currentBlock.collection_id,
          collectionName: (currentBlock.collections as any)?.name,
          preview: { category: category || undefined, title: title || undefined, description: description || undefined },
          currentValues: { category: currentBlock.category, title: currentBlock.title, description: currentBlock.description },
        };
      },
    }),

    addOrganization: tool({
      description: `Add a new organization/account. Use ONLY when the user provides a specific organization name. Checks for duplicates first.`,
      inputSchema: z.object({
        name: z.string(),
        description: z.string().optional(),
        website: z.string().optional(),
        type: z.string().optional(),
        size: z.string().optional(),
        status: organizationStatusSchema.optional().default(DEFAULT_ORGANIZATION_STATUS),
      }),
      execute: async ({ name, description, website, type, size, status }) => {
        onToolCall?.();
        const supabase = await createClient();
        const { data: existingOrganizations } = await supabase
          .from('organizations').select('id, name, status, type, website').eq('team_id', teamId);

        const nameLower = name.toLowerCase().trim();
        const similar = (existingOrganizations || []).filter((c: any) => {
          const existing = c.name.toLowerCase().trim();
          return existing === nameLower || existing.includes(nameLower) || nameLower.includes(existing)
            || (nameLower.length > 3 && existing.startsWith(nameLower.substring(0, Math.ceil(nameLower.length * 0.7))))
            || (existing.length > 3 && nameLower.startsWith(existing.substring(0, Math.ceil(existing.length * 0.7))));
        });

        if (similar.length > 0) {
          return {
            existingMatches: similar.map((c: any) => ({ id: c.id, name: c.name, status: c.status, type: c.type, website: c.website, url: `/app/organizations/${c.id}` })),
            requestedName: name,
            message: `Found ${similar.length} existing organization(s) with a similar name.`,
          };
        }

        return {
          needsConfirmation: true, confirmationType: 'add_organization', confirmationId: crypto.randomUUID(),
          preview: { name, description: description || undefined, website: website || undefined, type: type || undefined, size: size || undefined, status: status || DEFAULT_ORGANIZATION_STATUS },
        };
      },
    }),

    editOrganization: tool({
      description: `Edit an organization's details. Returns a preview that requires user confirmation.`,
      inputSchema: z.object({
        organizationId: z.number().optional(),
        organizationName: z.string().optional(),
        newName: z.string().optional(),
        newDescription: z.string().optional(),
        newWebsite: z.string().optional(),
        newType: z.string().optional(),
        newSize: z.string().optional(),
        newStatus: organizationStatusSchema.optional(),
      }),
      execute: async ({ organizationId, organizationName, newName, newDescription, newWebsite, newType, newSize, newStatus }) => {
        onToolCall?.();
        const supabase = await createClient();
        let currentOrganization = null;
        let resolvedId = organizationId;

        if (resolvedId) {
          const { data } = await supabase.from('organizations').select('*').eq('id', resolvedId).eq('team_id', teamId).single();
          currentOrganization = data;
        } else if (organizationName) {
          const { data } = await supabase.from('organizations').select('*').eq('team_id', teamId).ilike('name', `%${organizationName}%`).single();
          currentOrganization = data;
          resolvedId = data?.id;
        }

        if (!currentOrganization || !resolvedId) return { error: true, message: 'Organization not found.' };
        if (!newName && !newDescription && !newWebsite && !newType && !newSize && !newStatus) return { error: true, message: 'No changes specified.' };

        return {
          needsConfirmation: true, confirmationType: 'edit_organization', confirmationId: crypto.randomUUID(),
          organizationId: resolvedId, organizationName: currentOrganization.name,
          preview: { newName: newName || undefined, newDescription: newDescription || undefined, newWebsite: newWebsite || undefined, newType: newType || undefined, newSize: newSize || undefined, newStatus: newStatus || undefined },
          currentValues: { name: currentOrganization.name, description: currentOrganization.description, website: currentOrganization.website, type: currentOrganization.type, size: currentOrganization.size, status: currentOrganization.status },
        };
      },
    }),

    deleteOrganization: tool({
      description: `Delete an organization. Returns a preview that requires user confirmation.`,
      inputSchema: z.object({
        organizationId: z.number().optional(),
        organizationName: z.string().optional(),
      }),
      execute: async ({ organizationId, organizationName }) => {
        onToolCall?.();
        const supabase = await createClient();
        let currentOrganization = null;
        let resolvedId = organizationId;

        if (resolvedId) {
          const { data } = await supabase.from('organizations').select('id, name, status, type').eq('id', resolvedId).eq('team_id', teamId).single();
          currentOrganization = data;
        } else if (organizationName) {
          const { data } = await supabase.from('organizations').select('id, name, status, type').eq('team_id', teamId).ilike('name', `%${organizationName}%`).single();
          currentOrganization = data;
          resolvedId = data?.id;
        }

        if (!currentOrganization || !resolvedId) return { error: true, message: 'Organization not found.' };

        return {
          needsConfirmation: true, confirmationType: 'delete_organization', confirmationId: crypto.randomUUID(),
          organizationId: resolvedId, organizationName: currentOrganization.name,
          preview: { name: currentOrganization.name, status: currentOrganization.status, type: currentOrganization.type },
        };
      },
    }),
  };
}

export function createAllTools(ctx: ToolContext) {
  return {
    ...createReadTools(ctx),
    ...createWriteTools(ctx),
  };
}
