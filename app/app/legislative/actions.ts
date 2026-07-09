'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';

// ---- Bills ----

export async function getBillsForTeam() {
  const team = await getTeamForUser();
  if (!team) return [];
  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from('legislative_bills')
    .select('*')
    .eq('team_id', team.id)
    .order('created_at', { ascending: true });
  return data || [];
}

export async function createBillAction(bill: {
  bill_id: string;
  title: string;
  topic?: string;
  tier?: string;
  source_url?: string;
}) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('legislative_bills')
    .insert({
      team_id: team.id,
      bill_id: bill.bill_id,
      title: bill.title,
      topic: bill.topic || null,
      tier: bill.tier || 'Tier 2',
      source_url: bill.source_url || null,
      stages: [],
      history_actions: [],
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath('/app/legislative');
  return { data };
}

export async function updateBillAction(id: number, updates: Record<string, any>) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('legislative_bills')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('team_id', team.id)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath('/app/legislative');
  return { data };
}

export async function deleteBillAction(id: number) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from('legislative_bills')
    .delete()
    .eq('id', id)
    .eq('team_id', team.id);

  if (error) return { error: error.message };
  revalidatePath('/app/legislative');
  return { success: true };
}

// ---- Events ----

export async function getEventsForTeam() {
  const team = await getTeamForUser();
  if (!team) return [];
  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from('legislative_events')
    .select('*')
    .eq('team_id', team.id)
    .order('event_date', { ascending: true });
  return data || [];
}

export async function createEventAction(event: {
  title: string;
  description?: string;
  event_date: string;
  urgency?: string;
  badge_label?: string;
  event_type?: string;
}) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('legislative_events')
    .insert({
      team_id: team.id,
      title: event.title,
      description: event.description || null,
      event_date: event.event_date,
      urgency: event.urgency || 'future',
      badge_label: event.badge_label || null,
      event_type: event.event_type || 'event',
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath('/app/legislative');
  return { data };
}

export async function updateEventAction(id: number, updates: Record<string, any>) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('legislative_events')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('team_id', team.id)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath('/app/legislative');
  return { data };
}

export async function deleteEventAction(id: number) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from('legislative_events')
    .delete()
    .eq('id', id)
    .eq('team_id', team.id);

  if (error) return { error: error.message };
  revalidatePath('/app/legislative');
  return { success: true };
}
