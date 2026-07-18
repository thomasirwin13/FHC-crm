'use server';

import { createClient } from '@/lib/supabase/server';
import {
  getUser,
  getTeamForUser,
  updateCollection,
  createBlock,
  updateBlock,
  updateBlockEmbedding,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  logActivity,
} from '@/lib/db/supabase-queries';
import { ActivityType } from '@/lib/db/schema';
import { revalidatePath } from 'next/cache';
import { generateBlockEmbedding } from '@/lib/ai/embeddings';
import { DEFAULT_ORGANIZATION_STATUS } from '@/lib/constants/organization';

export async function createChat(userId: number, teamId: number, title: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('chats')
    .insert({ user_id: userId, team_id: teamId, title })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function saveMessage(
  userId: number,
  teamId: number,
  chatId: number,
  role: 'user' | 'assistant',
  content: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('messages')
    .insert({ chat_id: chatId, team_id: teamId, user_id: userId, role, content })
    .select()
    .single();
  if (error) throw error;

  // Update chat timestamp
  await supabase
    .from('chats')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', chatId);

  return data;
}

export async function getUserChats() {
  const user = await getUser();
  if (!user) return [];

  const team = await getTeamForUser();
  if (!team) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('user_id', user.id)
    .eq('team_id', team.id)
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('Error fetching user chats:', error);
    return [];
  }
  return data || [];
}

export async function getChatWithMessages(chatId: number) {
  const user = await getUser();
  if (!user) return null;

  const team = await getTeamForUser();
  if (!team) return null;

  const supabase = await createClient();

  const { data: chat } = await supabase
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .eq('user_id', user.id)
    .eq('team_id', team.id)
    .single();

  if (!chat) return null;

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });

  return { chat, messages: messages || [] };
}

export async function deleteChat(chatId: number) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  const team = await getTeamForUser();
  if (!team) throw new Error('Team not found');

  const supabase = await createClient();

  // Delete messages first (cascade)
  await supabase
    .from('messages')
    .delete()
    .eq('chat_id', chatId);

  // Delete the chat
  const { error } = await supabase
    .from('chats')
    .delete()
    .eq('id', chatId)
    .eq('user_id', user.id)
    .eq('team_id', team.id);

  if (error) throw error;
  return { success: true };
}

// =============================================================================
// Chat Confirmation Actions (for collection library management from chat)
// =============================================================================

export async function confirmEditCollection(data: {
  collectionId: number;
  name?: string;
  owner?: string;
  description?: string;
}) {
  const user = await getUser();
  if (!user) return { error: 'Unauthorized' };

  const team = await getTeamForUser();
  if (!team) return { error: 'Team not found' };

  const updates: Record<string, string | undefined> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.owner !== undefined) updates.owner = data.owner;
  if (data.description !== undefined) updates.description = data.description;

  if (Object.keys(updates).length === 0) {
    return { error: 'No updates provided' };
  }

  const result = await updateCollection(data.collectionId, team.id, updates);
  if (!result) {
    return { error: 'Failed to update collection' };
  }

  return { success: true, collection: result };
}

export async function confirmAddCollectionResource(data: {
  collectionId: number;
  label: string;
  url: string;
  type: 'marketing' | 'docs' | 'support' | 'other';
}) {
  const user = await getUser();
  if (!user) return { error: 'Unauthorized' };

  const team = await getTeamForUser();
  if (!team) return { error: 'Team not found' };

  const supabase = await createClient();

  // Fetch current collection to get existing urls
  const { data: collection, error: fetchError } = await supabase
    .from('collections')
    .select('urls')
    .eq('id', data.collectionId)
    .eq('team_id', team.id)
    .single();

  if (fetchError || !collection) {
    return { error: 'Collection not found' };
  }

  // Parse existing urls or start with empty array
  const existingUrls = (collection.urls as Array<{ label: string; url: string; type: string }>) || [];

  // Append new resource
  const newUrls = [
    ...existingUrls,
    { label: data.label, url: data.url, type: data.type },
  ];

  const result = await updateCollection(data.collectionId, team.id, { urls: newUrls });
  if (!result) {
    return { error: 'Failed to add resource' };
  }

  return { success: true, collection: result };
}

export async function confirmAddBlock(data: {
  collectionId: number;
  category?: string;
  title: string;
  description?: string;
}) {
  const user = await getUser();
  if (!user) return { error: 'Unauthorized' };

  const team = await getTeamForUser();
  if (!team) return { error: 'Team not found' };

  try {
    // Create the block
    const newBlock = await createBlock({
      collection_id: data.collectionId,
      team_id: team.id,
      updated_by: user.id,
      category: data.category || null,
      title: data.title,
      description: data.description || null,
    });

    // Generate and store embedding
    try {
      const embedding = await generateBlockEmbedding({
        category: data.category || null,
        title: data.title,
        description: data.description || null,
      });
      await updateBlockEmbedding(newBlock.id, embedding);
    } catch (embeddingError) {
      console.error('Error generating block embedding:', embeddingError);
      // Block was created, just log embedding error
    }

    return { success: true, block: newBlock };
  } catch (error) {
    console.error('Error creating block:', error);
    return { error: 'Failed to create block' };
  }
}

export async function confirmEditBlock(data: {
  blockId: number;
  category?: string;
  title?: string;
  description?: string;
}) {
  const user = await getUser();
  if (!user) return { error: 'Unauthorized' };

  const team = await getTeamForUser();
  if (!team) return { error: 'Team not found' };

  const updates: Record<string, string | null | undefined> = {};
  if (data.category !== undefined) updates.category = data.category || null;
  if (data.title !== undefined) updates.title = data.title;
  if (data.description !== undefined) updates.description = data.description || null;

  if (Object.keys(updates).length === 0) {
    return { error: 'No updates provided' };
  }

  const result = await updateBlock(data.blockId, team.id, updates);
  if (!result) {
    return { error: 'Failed to update block' };
  }

  // Regenerate embedding if block text changed
  if (data.title !== undefined || data.description !== undefined || data.category !== undefined) {
    try {
      const embedding = await generateBlockEmbedding({
        category: result.category,
        title: result.title,
        description: result.description,
      });
      await updateBlockEmbedding(result.id, embedding);
    } catch (embeddingError) {
      console.error('Error regenerating block embedding:', embeddingError);
    }
  }

  return { success: true, block: result };
}

// =============================================================================
// Organization Confirmation Actions
// =============================================================================

export async function confirmAddOrganization(data: {
  name: string;
  description?: string;
  website?: string;
  type?: string;
  size?: string;
  status?: string;
}) {
  const user = await getUser();
  if (!user) return { error: 'Unauthorized' };

  const team = await getTeamForUser();
  if (!team) return { error: 'Team not found' };

  try {
    const organization = await createOrganization({
      name: data.name,
      team_id: team.id,
      user_id: user.id,
      description: data.description || null,
      website: data.website || null,
      type: data.type || null,
      size: data.size || null,
      status: data.status || DEFAULT_ORGANIZATION_STATUS,
    });

    await logActivity(team.id, user.id, ActivityType.CREATE_ORGANIZATION);
    revalidatePath('/app/organizations');

    return { success: true, organization };
  } catch (error) {
    console.error('Error creating organization:', error);
    return { error: 'Failed to create organization' };
  }
}

export async function confirmEditOrganization(data: {
  organizationId: number;
  name?: string;
  description?: string;
  website?: string;
  type?: string;
  size?: string;
  status?: string;
}) {
  const user = await getUser();
  if (!user) return { error: 'Unauthorized' };

  const team = await getTeamForUser();
  if (!team) return { error: 'Team not found' };

  const updates: Record<string, string | null | undefined> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description || null;
  if (data.website !== undefined) updates.website = data.website || null;
  if (data.type !== undefined) updates.type = data.type || null;
  if (data.size !== undefined) updates.size = data.size || null;
  if (data.status !== undefined) updates.status = data.status;

  if (Object.keys(updates).length === 0) {
    return { error: 'No updates provided' };
  }

  const result = await updateOrganization(data.organizationId, team.id, updates);
  if (!result) {
    return { error: 'Failed to update organization' };
  }

  await logActivity(team.id, user.id, ActivityType.UPDATE_ORGANIZATION);
  revalidatePath('/app/organizations');

  return { success: true, organization: result };
}

export async function confirmDeleteOrganization(data: {
  organizationId: number;
}) {
  const user = await getUser();
  if (!user) return { error: 'Unauthorized' };

  const team = await getTeamForUser();
  if (!team) return { error: 'Team not found' };

  const result = await deleteOrganization(data.organizationId, team.id);
  if ('error' in result) {
    return { error: result.error };
  }

  await logActivity(team.id, user.id, ActivityType.DELETE_ORGANIZATION);
  revalidatePath('/app/organizations');

  return { success: true };
}

export async function confirmSaveAudienceSegment(data: {
  name: string;
  description?: string;
  filters: any[];
  estimatedCount: number;
  contactableEmail: number;
  contactableSms: number;
  excludedCount: number;
}) {
  const user = await getUser();
  if (!user) return { error: 'Unauthorized' };

  const team = await getTeamForUser();
  if (!team) return { error: 'Team not found' };

  const supabase = await createClient();
  const { data: segment, error } = await supabase
    .from('audience_segments')
    .insert({
      team_id: team.id,
      name: data.name,
      description: data.description ?? null,
      filter_definition: data.filters,
      estimated_count: data.estimatedCount,
      contactable_email: data.contactableEmail,
      contactable_sms: data.contactableSms,
      excluded_count: data.excludedCount,
      last_calculated_at: new Date().toISOString(),
      created_by: user.id,
    })
    .select('id, name')
    .single();

  if (error) return { error: error.message };

  await supabase.from('audit_events').insert({
    team_id: team.id,
    user_id: user.id,
    event_type: 'audience_segment_created',
    entity_type: 'audience_segment',
    entity_id: segment.id,
    details: { name: data.name, filterCount: data.filters.length, estimatedCount: data.estimatedCount },
  });

  return { success: true, segmentId: segment.id, segmentName: segment.name };
}

export async function confirmCreateCampaignDraft(data: {
  audienceSegmentId: number;
  channel: string;
  subject?: string;
  messageBody: string;
  tone?: string;
  callToAction?: string;
  districtContext?: string;
}) {
  const user = await getUser();
  if (!user) return { error: 'Unauthorized' };

  const team = await getTeamForUser();
  if (!team) return { error: 'Team not found' };

  const supabase = await createClient();

  const { data: segment } = await supabase
    .from('audience_segments')
    .select('id')
    .eq('id', data.audienceSegmentId)
    .eq('team_id', team.id)
    .single();

  if (!segment) return { error: 'Audience segment not found or access denied' };

  const { data: campaign, error } = await supabase
    .from('campaign_drafts')
    .insert({
      team_id: team.id,
      audience_segment_id: data.audienceSegmentId,
      channel: data.channel,
      subject: data.subject ?? null,
      message_body: data.messageBody,
      tone: data.tone ?? null,
      call_to_action: data.callToAction ?? null,
      district_context: data.districtContext ?? null,
      status: 'draft',
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  await supabase.from('audit_events').insert({
    team_id: team.id,
    user_id: user.id,
    event_type: 'campaign_draft_created',
    entity_type: 'campaign_draft',
    entity_id: campaign.id,
    details: { channel: data.channel, audienceSegmentId: data.audienceSegmentId },
  });

  return { success: true, campaignId: campaign.id, status: 'draft' };
}

// Save a synthetic assistant message after a confirmation action completes
export async function saveConfirmationFollowUp(chatId: number, content: string) {
  const user = await getUser();
  if (!user) return;

  const team = await getTeamForUser();
  if (!team) return;

  await saveMessage(user.id, team.id, chatId, 'assistant', content);
}
