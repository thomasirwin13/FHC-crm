/**
 * Supabase Data API queries
 *
 * These use the Supabase client (PostgREST) instead of direct database connections.
 * RLS is automatically enforced via auth.uid() from Supabase Auth sessions.
 *
 * All functions return snake_case data matching the database.types.ts types.
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/db/database.types';

// =============================================================================
// Type Aliases (for convenience)
// =============================================================================

export type User = Tables<'users'>;
export type Team = Tables<'teams'>;
export type TeamMember = Tables<'team_members'>;
export type Collection = Tables<'collections'>;
export type ContentBlock = Tables<'content_blocks'>;
export type Organization = Tables<'organizations'>;
export type Contact = Tables<'contacts'>;
export type ActivityLog = Tables<'activity_logs'>;
export type Invitation = Tables<'invitations'>;

// =============================================================================
// Vector Utility Functions
// =============================================================================

export function formatVectorForRPC(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

// =============================================================================
// Core Auth Queries
// =============================================================================

/**
 * Get the current authenticated user
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  if (!supabaseUser) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('supabase_auth_id', supabaseUser.id)
    .is('deleted_at', null)
    .single();

  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }

  return data;
}

/**
 * Get user with their team ID
 */
export async function getUserWithTeam(userId: number) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('users')
    .select(`
      *,
      team_members!inner(team_id, role)
    `)
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user with team:', error);
    return null;
  }

  // Flatten team_id and role from team_members array for easier access
  const teamMembers = data.team_members as Array<{ team_id: number; role: string }> | undefined;
  const team_id = teamMembers?.[0]?.team_id ?? null;

  return { ...data, team_id, team_members: teamMembers };
}

/**
 * Get the current user's team with all members
 * Returns team object with currentUserRole for permission checks
 */
export async function getTeamForUser() {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('team_members')
    .select(`
      *,
      team:teams(
        *,
        team_members(
          *,
          user:users(id, name, email)
        )
      )
    `)
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching team for user:', error);
    return null;
  }

  if (!data?.team) return null;

  // Return team with current user's role for permission checks
  return {
    ...data.team,
    currentUserRole: data.role as 'owner' | 'member',
  };
}

/**
 * Get team with pending invitations
 */
export async function getTeamWithInvitations() {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();

  // Get team membership
  const { data: teamMember, error: teamError } = await supabase
    .from('team_members')
    .select(`
      *,
      team:teams(
        *,
        team_members(
          *,
          user:users(id, name, email)
        )
      )
    `)
    .eq('user_id', user.id)
    .single();

  if (teamError || !teamMember?.team) {
    console.error('Error fetching team:', teamError);
    return null;
  }

  // Get pending invitations
  const { data: invitations, error: invError } = await supabase
    .from('invitations')
    .select('id, email, role, invited_at, invited_by')
    .eq('team_id', teamMember.team.id)
    .eq('status', 'pending');

  if (invError) {
    console.error('Error fetching invitations:', invError);
  }

  return {
    ...teamMember.team,
    invitations: invitations || []
  };
}

/**
 * Get activity logs for the current user
 */
export async function getActivityLogs() {
  const user = await getUser();
  if (!user) throw new Error('User not authenticated');

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('activity_logs')
    .select(`
      id,
      action,
      timestamp,
      ip_address,
      user:users!user_id(name)
    `)
    .eq('user_id', user.id)
    .order('timestamp', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching activity logs:', error);
    return [];
  }

  return data || [];
}

/**
 * Log an activity event
 */
export async function logActivity(
  team_id: number,
  user_id: number,
  action: string,
  ip_address?: string
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('activity_logs')
    .insert({
      team_id,
      user_id,
      action,
      ip_address: ip_address || null
    });

  if (error) {
    console.error('Error logging activity:', error);
  }
}


// =============================================================================
// Organization CRUD Operations
// =============================================================================

export async function getOrganizationsForTeam(team_id: number) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('organizations')
    .select(`
      *,
      user:users!user_id(id, name, email)
    `)
    .eq('team_id', team_id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching organizations:', error);
    return [];
  }

  return data || [];
}

export async function getOrganizationById(org_id: number, team_id: number) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', org_id)
    .eq('team_id', team_id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching organization:', error);
    return null;
  }

  return data;
}

export async function createOrganization(orgData: TablesInsert<'organizations'>) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('organizations')
    .insert(orgData)
    .select()
    .single();

  if (error) {
    console.error('Error creating organization:', error);
    throw error;
  }

  return data;
}

export async function updateOrganization(
  org_id: number,
  team_id: number,
  updates: TablesUpdate<'organizations'>
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('organizations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', org_id)
    .eq('team_id', team_id)
    .select()
    .single();

  if (error) {
    console.error('Error updating organization:', error);
    return null;
  }

  return data;
}

export async function setOrganizationTeamLeader(org_id: number, team_id: number, contact_id: number | null) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('organizations')
    .update({ team_leader_id: contact_id, updated_at: new Date().toISOString() } as any)
    .eq('id', org_id)
    .eq('team_id', team_id)
    .select()
    .single();

  if (error) {
    console.error('Error setting team leader:', error);
    return null;
  }
  return data;
}

export async function deleteOrganization(org_id: number, team_id: number) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('organizations')
    .delete()
    .eq('id', org_id)
    .eq('team_id', team_id);

  if (error) {
    console.error('Error deleting organization:', error);
    return { error: 'Failed to delete organization' } as const;
  }

  return { success: true } as const;
}

// =============================================================================
// Contact CRUD Operations
// =============================================================================

export async function getContactsForOrganization(org_id: number, team_id: number) {
  const supabase = await createClient();

  // Use junction table (many-to-many)
  const { data, error } = await (supabase as any)
    .from('contact_organizations')
    .select('contact:contacts(*)')
    .eq('organization_id', org_id)
    .eq('team_id', team_id);

  if (error) {
    console.error('Error fetching contacts for organization:', error);
    return [];
  }

  return ((data || []).map((d: any) => d.contact).filter(Boolean)) as Tables<'contacts'>[];
}

export async function getOrganizationsForContact(contact_id: number, team_id: number) {
  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from('contact_organizations')
    .select('organization:organizations(id, name, type, status)')
    .eq('contact_id', contact_id)
    .eq('team_id', team_id);

  if (error) {
    console.error('Error fetching organizations for contact:', error);
    return [];
  }

  return ((data || []).map((d: any) => d.organization).filter(Boolean)) as Tables<'organizations'>[];
}

export async function addContactToOrganization(contact_id: number, organization_id: number, team_id: number) {
  const supabase = await createClient();

  const { error } = await (supabase as any)
    .from('contact_organizations')
    .insert({ contact_id, organization_id, team_id });

  if (error) {
    console.error('Error adding contact to organization:', error);
    return false;
  }

  return true;
}

export async function removeContactFromOrganization(contact_id: number, organization_id: number, team_id: number) {
  const supabase = await createClient();

  const { error } = await (supabase as any)
    .from('contact_organizations')
    .delete()
    .eq('contact_id', contact_id)
    .eq('organization_id', organization_id)
    .eq('team_id', team_id);

  if (error) {
    console.error('Error removing contact from organization:', error);
    return false;
  }

  return true;
}

export async function getContactsForTeam(team_id: number) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('contacts')
    .select('*, organization:organizations!contacts_organization_id_fkey(id, name)')
    .eq('team_id', team_id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching contacts for team:', error);
    return [];
  }

  return data || [];
}

export type ContactWithOrganization = Awaited<ReturnType<typeof getContactsForTeam>>[number];

export async function getContactById(contact_id: number, team_id: number) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contact_id)
    .eq('team_id', team_id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching contact:', error);
    return null;
  }

  return data;
}

export async function createContact(contactData: TablesInsert<'contacts'>) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('contacts')
    .insert(contactData)
    .select()
    .single();

  if (error) {
    console.error('Error creating contact:', error);
    throw error;
  }

  return data;
}

export async function updateContact(
  contact_id: number,
  team_id: number,
  updates: TablesUpdate<'contacts'>
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('contacts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', contact_id)
    .eq('team_id', team_id)
    .select()
    .single();

  if (error) {
    console.error('Error updating contact:', error);
    return null;
  }

  return data;
}

export async function deleteContact(contact_id: number, team_id: number) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', contact_id)
    .eq('team_id', team_id);

  if (error) {
    console.error('Error deleting contact:', error);
    return false;
  }

  return true;
}

export async function unlinkContactsFromOrganization(org_id: number, team_id: number) {
  const supabase = await createClient();

  const { error } = await (supabase as any)
    .from('contact_organizations')
    .delete()
    .eq('organization_id', org_id)
    .eq('team_id', team_id);

  if (error) {
    console.error('Error unlinking contacts from organization:', error);
    return false;
  }

  return true;
}

// =============================================================================
// Contact Categories
// =============================================================================

export async function getCategoriesForTeam(team_id: number) {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('contact_categories')
    .select('*')
    .eq('team_id', team_id)
    .order('name', { ascending: true });
  if (error) { console.error('Error fetching categories:', error); return []; }
  return (data || []) as { id: number; name: string; color: string; team_id: number }[];
}

export async function createCategory(team_id: number, name: string, color: string) {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('contact_categories')
    .insert({ team_id, name, color })
    .select()
    .single();
  if (error) { console.error('Error creating category:', error); return null; }
  return data as { id: number; name: string; color: string; team_id: number };
}

export async function deleteCategory(category_id: number, team_id: number) {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from('contact_categories')
    .delete()
    .eq('id', category_id)
    .eq('team_id', team_id);
  return !error;
}

export async function getCategoriesForContact(contact_id: number, team_id: number) {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('contact_category_assignments')
    .select('category:contact_categories(id, name, color)')
    .eq('contact_id', contact_id)
    .eq('team_id', team_id);
  if (error) { console.error('Error fetching contact categories:', error); return []; }
  return ((data || []).map((d: any) => d.category).filter(Boolean)) as { id: number; name: string; color: string }[];
}

export async function addCategoryToContact(contact_id: number, category_id: number, team_id: number) {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from('contact_category_assignments')
    .insert({ contact_id, category_id, team_id });
  return !error;
}

export async function removeCategoryFromContact(contact_id: number, category_id: number, team_id: number) {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from('contact_category_assignments')
    .delete()
    .eq('contact_id', contact_id)
    .eq('category_id', category_id)
    .eq('team_id', team_id);
  return !error;
}

export async function getContactsByCategory(category_id: number, team_id: number) {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('contact_category_assignments')
    .select('contact:contacts(id, name, email, phone, city, state, action_committed, preferred_contact_method)')
    .eq('category_id', category_id)
    .eq('team_id', team_id);
  if (error) { console.error('Error fetching contacts by category:', error); return []; }
  return ((data || []).map((d: any) => d.contact).filter(Boolean)) as any[];
}

export async function getCategoryContactCounts(team_id: number) {
  const supabase = await createClient();
  const { data: categories } = await (supabase as any)
    .from('contact_categories')
    .select('id, name, color')
    .eq('team_id', team_id)
    .order('name');
  if (!categories) return [];

  const counts = await Promise.all(
    (categories as any[]).map(async (cat) => {
      const { count } = await (supabase as any)
        .from('contact_category_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', cat.id)
        .eq('team_id', team_id);
      return { ...cat, count: count ?? 0 };
    })
  );
  return counts as { id: number; name: string; color: string; count: number }[];
}

// =============================================================================
// Collection CRUD Operations
// =============================================================================

export async function getCollectionsForTeam(team_id: number) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('collections')
    .select(`
      *,
      blocks:content_blocks(count)
    `)
    .eq('team_id', team_id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching collections:', error);
    return [];
  }

  return data || [];
}

export async function getCollectionById(collection_id: number, team_id: number) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('collections')
    .select(`
      *,
      blocks:content_blocks(*)
    `)
    .eq('id', collection_id)
    .eq('team_id', team_id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching collection:', error);
    return null;
  }

  return data;
}

export async function createCollection(collectionData: TablesInsert<'collections'>) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('collections')
    .insert(collectionData)
    .select()
    .single();

  if (error) {
    console.error('Error creating collection:', error);
    throw error;
  }

  return data;
}

export async function updateCollection(
  collection_id: number,
  team_id: number,
  updates: TablesUpdate<'collections'>
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('collections')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', collection_id)
    .eq('team_id', team_id)
    .select()
    .single();

  if (error) {
    console.error('Error updating collection:', error);
    return null;
  }

  return data;
}

export async function deleteCollection(collection_id: number, team_id: number) {
  const supabase = await createClient();

  // Delete content_blocks first (FK constraint)
  const { error: blocksError } = await supabase
    .from('content_blocks')
    .delete()
    .eq('collection_id', collection_id)
    .eq('team_id', team_id);

  if (blocksError) {
    console.error('Error deleting content blocks:', blocksError);
    return false;
  }

  // Now delete the collection
  const { error } = await supabase
    .from('collections')
    .delete()
    .eq('id', collection_id)
    .eq('team_id', team_id);

  if (error) {
    console.error('Error deleting collection:', error);
    return false;
  }

  return true;
}

/**
 * Get or create a default collection for a team
 */
export async function getOrCreateDefaultCollection(team_id: number, owner: string) {
  const supabase = await createClient();

  // Try to get existing default collection
  const { data: existing } = await supabase
    .from('collections')
    .select('*')
    .eq('team_id', team_id)
    .eq('name', 'Default Collection')
    .single();

  if (existing) return existing;

  // Create default collection
  const { data, error } = await supabase
    .from('collections')
    .insert({
      team_id,
      name: 'Default Collection',
      owner
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating default collection:', error);
    throw error;
  }

  return data;
}

// =============================================================================
// Content Block CRUD Operations
// =============================================================================

export async function getBlocksForCollection(collection_id: number, team_id: number) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('content_blocks')
    .select(`
      *,
      updated_by_user:users!updated_by(id, name, email)
    `)
    .eq('collection_id', collection_id)
    .eq('team_id', team_id)
    .order('block_number', { ascending: true });

  if (error) {
    console.error('Error fetching content blocks:', error);
    return [];
  }

  return data || [];
}

export async function getBlocksForTeam(team_id: number) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('content_blocks')
    .select(`
      *,
      updated_by_user:users!updated_by(id, name, email)
    `)
    .eq('team_id', team_id)
    .order('last_updated', { ascending: false });

  if (error) {
    console.error('Error fetching content blocks for team:', error);
    return [];
  }

  return data || [];
}

export async function getBlockById(block_id: number, team_id: number) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('content_blocks')
    .select('*')
    .eq('id', block_id)
    .eq('team_id', team_id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching content block:', error);
    return null;
  }

  return data;
}

export async function createBlock(blockData: TablesInsert<'content_blocks'>) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('content_blocks')
    .insert(blockData)
    .select()
    .single();

  if (error) {
    console.error('Error creating content block:', error);
    throw error;
  }

  return data;
}

export async function updateBlock(
  block_id: number,
  team_id: number,
  updates: TablesUpdate<'content_blocks'>
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('content_blocks')
    .update({ ...updates, last_updated: new Date().toISOString() })
    .eq('id', block_id)
    .eq('team_id', team_id)
    .select()
    .single();

  if (error) {
    console.error('Error updating content block:', error);
    return null;
  }

  return data;
}

export async function deleteBlock(block_id: number, team_id: number) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('content_blocks')
    .delete()
    .eq('id', block_id)
    .eq('team_id', team_id);

  if (error) {
    console.error('Error deleting content block:', error);
    return false;
  }

  return true;
}

export async function bulkCreateBlocks(blocks: TablesInsert<'content_blocks'>[]) {
  if (blocks.length === 0) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('content_blocks')
    .insert(blocks)
    .select();

  if (error) {
    console.error('Error bulk creating content blocks:', error);
    throw error;
  }

  return data || [];
}

// =============================================================================
// =============================================================================
// Vector Operations (using RPC functions)
// =============================================================================

/**
 * Update a content block's embedding vector via RPC
 */
export async function updateBlockEmbedding(block_id: number, embedding: number[]) {
  const supabase = await createClient();

  const { error } = await supabase.rpc('update_block_embedding', {
    p_block_id: block_id,
    p_vector: formatVectorForRPC(embedding)
  });

  if (error) {
    console.error('Error updating block embedding:', error);
    throw error;
  }
}

/**
 * Search for similar content blocks by vector
 */
export async function searchSimilarBlocks(
  query_vector: number[],
  team_id: number,
  limit: number = 10
) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('search_similar_blocks', {
    p_query_vector: formatVectorForRPC(query_vector),
    p_team_id: team_id,
    p_limit: limit
  });

  if (error) {
    console.error('Error searching similar blocks:', error);
    return [];
  }

  return data || [];
}

// =============================================================================
// Team Operations
// =============================================================================

export async function getTeamById(team_id: number) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('id', team_id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching team:', error);
    return null;
  }

  return data;
}

export async function updateTeam(team_id: number, updates: TablesUpdate<'teams'>) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('teams')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', team_id)
    .select()
    .single();

  if (error) {
    console.error('Error updating team:', error);
    return null;
  }

  return data;
}

// Default system prompt for new teams
// =============================================================================
// Vector Operations with Embedding Generation
// =============================================================================

/**
 * Generate and update content block embedding
 * This fetches the block, generates embedding, and updates via RPC
 */
export async function generateAndUpdateBlockEmbedding(block_id: number, team_id: number) {
  const supabase = await createClient();

  // Import embedding generator dynamically to avoid circular deps
  const { generateBlockEmbedding } = await import('@/lib/ai/embeddings');

  // Get the content block
  const { data: block, error: fetchError } = await supabase
    .from('content_blocks')
    .select('*')
    .eq('id', block_id)
    .eq('team_id', team_id)
    .single();

  if (fetchError || !block) {
    throw new Error('Content block not found or access denied');
  }

  // Generate embedding
  const embedding = await generateBlockEmbedding({
    blockNumber: block.block_number,
    category: block.category,
    title: block.title,
    description: block.description,
  });

  // Update via RPC
  const { error: updateError } = await supabase.rpc('update_block_embedding', {
    p_block_id: block_id,
    p_vector: formatVectorForRPC(embedding),
  });

  if (updateError) {
    console.error('Error updating block embedding:', updateError);
    throw updateError;
  }

  return { success: true };
}

/**
 * Batch generate embeddings for all content blocks in a collection
 */
export async function batchUpdateBlockEmbeddings(collection_id: number, team_id: number) {
  const supabase = await createClient();

  const { data: blocks, error } = await supabase
    .from('content_blocks')
    .select('id')
    .eq('collection_id', collection_id)
    .eq('team_id', team_id);

  if (error || !blocks) {
    throw new Error('Failed to fetch content blocks');
  }

  let updated = 0;
  let failed = 0;

  for (const block of blocks) {
    try {
      await generateAndUpdateBlockEmbedding(block.id, team_id);
      updated++;
      // Add delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`Failed to update embedding for block ${block.id}:`, err);
      failed++;
    }
  }

  return { total: blocks.length, updated, failed };
}

/**
 * Batch generate embeddings for all content blocks in a team
 */
export async function batchUpdateAllBlockEmbeddings(team_id: number) {
  const supabase = await createClient();

  const { data: blocks, error } = await supabase
    .from('content_blocks')
    .select('id')
    .eq('team_id', team_id);

  if (error || !blocks) {
    throw new Error('Failed to fetch content blocks');
  }

  let updated = 0;
  let failed = 0;

  for (const block of blocks) {
    try {
      await generateAndUpdateBlockEmbedding(block.id, team_id);
      updated++;
      // Add delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`Failed to update embedding for block ${block.id}:`, err);
      failed++;
    }
  }

  return { total: blocks.length, updated, failed };
}

/**
 * Count total collections for a team
 */
export async function countCollectionsForTeam(teamId: number): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from('collections')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId);

  if (error) {
    console.error('Error counting collections:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Count team members + pending invitations
 */
export async function countTeamMembersAndInvitations(teamId: number): Promise<number> {
  const supabase = await createClient();

  // Count team members
  const { count: membersCount, error: membersError } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId);

  if (membersError) {
    console.error('Error counting team members:', membersError);
    return 0;
  }

  // Count pending invitations
  const { count: invitationsCount, error: invitationsError } = await supabase
    .from('invitations')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .eq('status', 'pending');

  if (invitationsError) {
    console.error('Error counting invitations:', invitationsError);
    return membersCount || 0;
  }

  return (membersCount || 0) + (invitationsCount || 0);
}

/**
 * Delete all team data (collections, content blocks, organizations, contacts, chats)
 * Used when user wants to clear example data or start fresh
 * Uses admin client to bypass RLS for this privileged operation
 */
export async function deleteAllTeamData(teamId: number): Promise<boolean> {
  // Use admin client to bypass RLS for this privileged delete operation
  const supabase = createAdminClient();

  try {
    // Delete in order respecting foreign key constraints:
    // 1. Content blocks (references collections)
    const { error: blocksError } = await supabase
      .from('content_blocks')
      .delete()
      .eq('team_id', teamId);
    if (blocksError) {
      console.error('Error deleting content_blocks:', blocksError);
      throw blocksError;
    }

    // 2. Collections
    const { error: collectionsError } = await supabase
      .from('collections')
      .delete()
      .eq('team_id', teamId);
    if (collectionsError) {
      console.error('Error deleting collections:', collectionsError);
      throw collectionsError;
    }

    // 3. Contacts (references organizations)
    const { error: contactsError } = await supabase
      .from('contacts')
      .delete()
      .eq('team_id', teamId);
    if (contactsError) {
      console.error('Error deleting contacts:', contactsError);
      throw contactsError;
    }

    // 4. Organizations
    const { error: orgsError } = await supabase
      .from('organizations')
      .delete()
      .eq('team_id', teamId);
    if (orgsError) {
      console.error('Error deleting organizations:', orgsError);
      throw orgsError;
    }

    // 5. Chat messages (references chats)
    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .eq('team_id', teamId);
    if (messagesError) {
      console.error('Error deleting messages:', messagesError);
      throw messagesError;
    }

    // 6. Chats
    const { error: chatsError } = await supabase
      .from('chats')
      .delete()
      .eq('team_id', teamId);
    if (chatsError) {
      console.error('Error deleting chats:', chatsError);
      throw chatsError;
    }

    return true;
  } catch (error) {
    console.error('Error deleting all team data:', error);
    return false;
  }
}

// =============================================================================
// Meetings
// =============================================================================

export async function getMeetingsForTeam(team_id: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('meetings')
    .select('*, attendance:meeting_attendance(id, contact_id)')
    .eq('team_id', team_id)
    .order('date', { ascending: false });
  if (error) { console.error('Error fetching meetings:', error); return []; }
  return data || [];
}

export type MeetingWithAttendance = Awaited<ReturnType<typeof getMeetingsForTeam>>[number];

export async function getMeetingById(meeting_id: number, team_id: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('meetings')
    .select('*, attendance:meeting_attendance(id, contact_id, contact:contacts(id, name, email))')
    .eq('id', meeting_id)
    .eq('team_id', team_id)
    .single();
  if (error && error.code !== 'PGRST116') { console.error('Error fetching meeting:', error); return null; }
  return data;
}

export async function createMeeting(data: TablesInsert<'meetings'>) {
  const supabase = await createClient();
  const { data: meeting, error } = await supabase.from('meetings').insert(data).select().single();
  if (error) { console.error('Error creating meeting:', error); throw error; }
  return meeting;
}

export async function updateMeeting(meeting_id: number, team_id: number, updates: TablesUpdate<'meetings'>) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('meetings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', meeting_id)
    .eq('team_id', team_id)
    .select()
    .single();
  if (error) { console.error('Error updating meeting:', error); return null; }
  return data;
}

export async function deleteMeeting(meeting_id: number, team_id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from('meetings').delete().eq('id', meeting_id).eq('team_id', team_id);
  if (error) { console.error('Error deleting meeting:', error); return false; }
  return true;
}

export async function setMeetingAttendance(meeting_id: number, team_id: number, contact_ids: number[]) {
  const supabase = await createClient();
  // Delete existing attendance for this meeting
  await supabase.from('meeting_attendance').delete().eq('meeting_id', meeting_id);
  if (contact_ids.length === 0) return true;
  const rows = contact_ids.map(contact_id => ({ meeting_id, contact_id, team_id }));
  const { error } = await supabase.from('meeting_attendance').insert(rows);
  if (error) { console.error('Error setting meeting attendance:', error); return false; }
  return true;
}

export async function addMeetingAttendance(meeting_id: number, contact_id: number, team_id: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('meeting_attendance')
    .insert({ meeting_id, contact_id, team_id });
  if (error && error.code !== '23505') { // ignore unique-constraint duplicates
    console.error('Error adding meeting attendance:', error);
    return false;
  }
  return true;
}

export async function removeMeetingAttendance(meeting_id: number, contact_id: number, team_id: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('meeting_attendance')
    .delete()
    .eq('meeting_id', meeting_id)
    .eq('contact_id', contact_id)
    .eq('team_id', team_id);
  if (error) { console.error('Error removing meeting attendance:', error); return false; }
  return true;
}

export async function getMeetingAttendanceForContact(contact_id: number, team_id: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('meeting_attendance')
    .select('*, meeting:meetings(id, name, date, location)')
    .eq('contact_id', contact_id)
    .eq('team_id', team_id)
    .order('created_at', { ascending: false });
  if (error) { console.error('Error fetching meeting attendance for contact:', error); return []; }
  return data || [];
}

// =============================================================================
// One-on-Ones
// =============================================================================

export async function getOneOnOnesForContact(contact_id: number, team_id: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('one_on_ones')
    .select('*, organizer:users!user_id(id, name, email)')
    .eq('contact_id', contact_id)
    .eq('team_id', team_id)
    .order('date', { ascending: false });
  if (error) { console.error('Error fetching one-on-ones:', error); return []; }
  return data || [];
}

export type OneOnOne = Awaited<ReturnType<typeof getOneOnOnesForContact>>[number];

export async function createOneOnOne(data: TablesInsert<'one_on_ones'>) {
  const supabase = await createClient();
  const { data: record, error } = await supabase.from('one_on_ones').insert(data).select().single();
  if (error) { console.error('Error creating one-on-one:', error); throw error; }
  return record;
}

export async function updateOneOnOne(id: number, team_id: number, updates: TablesUpdate<'one_on_ones'>) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('one_on_ones')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('team_id', team_id)
    .select()
    .single();
  if (error) { console.error('Error updating one-on-one:', error); return null; }
  return data;
}

export async function deleteOneOnOne(id: number, team_id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from('one_on_ones').delete().eq('id', id).eq('team_id', team_id);
  if (error) { console.error('Error deleting one-on-one:', error); return false; }
  return true;
}

// =============================================================================
// Hard Delete User & Team (Full Cascade)
// =============================================================================

/**
 * Hard delete a user, their team, and all team data.
 * Deletes in FK-safe order to avoid constraint violations.
 * Uses admin client to bypass RLS.
 *
 * Returns counts of deleted rows per table for logging.
 */
export async function hardDeleteUserAndTeam(
  adminSupabase: ReturnType<typeof createAdminClient>,
  userId: number,
  teamId: number,
  supabaseAuthId: string | null
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  async function deleteFrom(table: string, filter: Record<string, any>) {
    const { data, error } = await (adminSupabase.from(table as any) as any).delete().match(filter).select('id');
    if (error) {
      console.error(`Error deleting from ${table}:`, error);
      throw error;
    }
    counts[table] = data?.length ?? 0;
  }

  // Delete in FK-safe order (children before parents)
  // 1. messages → chats, users, teams
  await deleteFrom('messages', { team_id: teamId });
  // 2. chats → users, teams
  await deleteFrom('chats', { team_id: teamId });
  // 3. activity_logs → users, teams
  await deleteFrom('activity_logs', { team_id: teamId });
  // 4. contacts → organizations, teams
  await deleteFrom('contacts', { team_id: teamId });
  // 7. organizations → users, teams
  await deleteFrom('organizations', { team_id: teamId });
  // 8. content_blocks → collections, users, teams
  await deleteFrom('content_blocks', { team_id: teamId });
  // 9. collections → teams
  await deleteFrom('collections', { team_id: teamId });
  // 10. invitations → teams, users
  await deleteFrom('invitations', { team_id: teamId });
  // 11. system_prompts → teams
  await deleteFrom('system_prompts', { team_id: teamId });
  // 12. team_members → users, teams
  await deleteFrom('team_members', { team_id: teamId });
  // 13. teams
  await deleteFrom('teams', { id: teamId });
  // 14. users
  await deleteFrom('users', { id: userId });

  // 17. auth.users (via admin API)
  if (supabaseAuthId) {
    const { error: authDeleteError } = await adminSupabase.auth.admin.deleteUser(supabaseAuthId);
    if (authDeleteError) {
      console.error('Error deleting auth user:', authDeleteError);
      throw authDeleteError;
    }
    counts['auth.users'] = 1;
  }

  return counts;
}
