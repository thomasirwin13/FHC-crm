'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';
import { fetchBill, extractBillData, isConfigured } from '@/lib/openstates';
import { createBillItem, isConfigured as isMondayConfigured } from '@/lib/monday';
import { fetchCouncilFile } from '@/lib/lacity';

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

export async function createBillAction(
  billId: string,
  location: string,
  topic: string,
) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  console.log('[createBillAction] billId:', billId, 'location:', location, 'topic:', topic);
  const isLACity = location === 'LA City' || location?.toLowerCase().includes('la city');
  let scraped;

  if (isLACity) {
    try {
      const cf = await fetchCouncilFile(billId);
      if (!cf) return { error: `Council file "${billId}" not found on LA City Clerk` };
      scraped = cf;
    } catch (e: any) {
      return { error: `Failed to fetch council file: ${e.message}` };
    }
  } else {
    if (!isConfigured()) return { error: 'OPENSTATES_API_KEY not configured' };
    try {
      const apiBill = await fetchBill(billId, 'ca');
      if (!apiBill) return { error: `Bill "${billId}" not found on Open States` };
      scraped = extractBillData(apiBill);
    } catch (e: any) {
      return { error: `Failed to fetch bill: ${e.message}` };
    }
  }

  const billIdNormalized = isLACity
    ? billId.trim().replace(/^CF\s*/i, '')
    : billId.toUpperCase().replace(/[.\-]/g, '').replace(/([A-Z]+)\s*(\d+)/, '$1 $2');

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('legislative_bills')
    .insert({
      team_id: team.id,
      bill_id: billIdNormalized,
      title: scraped.title,
      topic: topic || null,
      house_location: scraped.house_location,
      committee_location: scraped.committee_location,
      lead_authors: scraped.lead_authors,
      principal_coauthors: scraped.principal_coauthors,
      coauthors: scraped.coauthors,
      history_actions: scraped.history_actions,
      stages: scraped.stages,
      source_url: scraped.source_url,
      last_scraped: scraped.last_scraped,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath('/app/legislative');
  return { data };
}

export async function refreshBillAction(id: number) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const supabase = await createClient();
  const { data: existing } = await (supabase as any)
    .from('legislative_bills')
    .select('bill_id, house_location')
    .eq('id', id)
    .eq('team_id', team.id)
    .single();

  if (!existing) return { error: 'Bill not found' };

  const isLACity = existing.house_location === 'LA City Council';
  let scraped;

  if (isLACity) {
    try {
      const cf = await fetchCouncilFile(existing.bill_id);
      if (!cf) return { error: `Council file "${existing.bill_id}" not found` };
      scraped = cf;
    } catch (e: any) {
      return { error: `Failed to fetch council file: ${e.message}` };
    }
  } else {
    if (!isConfigured()) return { error: 'OPENSTATES_API_KEY not configured' };
    try {
      const apiBill = await fetchBill(existing.bill_id, 'ca');
      if (!apiBill) return { error: `Bill "${existing.bill_id}" not found on Open States` };
      scraped = extractBillData(apiBill);
    } catch (e: any) {
      return { error: `Failed to fetch bill: ${e.message}` };
    }
  }

  const { data, error } = await (supabase as any)
    .from('legislative_bills')
    .update({
      title: scraped.title,
      house_location: scraped.house_location,
      committee_location: scraped.committee_location,
      lead_authors: scraped.lead_authors,
      principal_coauthors: scraped.principal_coauthors,
      coauthors: scraped.coauthors,
      history_actions: scraped.history_actions,
      stages: scraped.stages,
      source_url: scraped.source_url,
      last_scraped: scraped.last_scraped,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('team_id', team.id)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath('/app/legislative');
  return { data };
}

export async function refreshAllBillsAction() {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const supabase = await createClient();
  const { data: bills } = await (supabase as any)
    .from('legislative_bills')
    .select('id, bill_id, house_location')
    .eq('team_id', team.id);

  if (!bills || bills.length === 0) return { refreshed: 0 };

  let refreshed = 0;
  for (const bill of bills) {
    try {
      let scraped;
      if (bill.house_location === 'LA City Council') {
        const cf = await fetchCouncilFile(bill.bill_id);
        if (!cf) continue;
        scraped = cf;
      } else {
        if (!isConfigured()) continue;
        const apiBill = await fetchBill(bill.bill_id, 'ca');
        if (!apiBill) continue;
        scraped = extractBillData(apiBill);
      }
      await (supabase as any)
        .from('legislative_bills')
        .update({
          title: scraped.title,
          house_location: scraped.house_location,
          committee_location: scraped.committee_location,
          lead_authors: scraped.lead_authors,
          principal_coauthors: scraped.principal_coauthors,
          coauthors: scraped.coauthors,
          history_actions: scraped.history_actions,
          stages: scraped.stages,
          source_url: scraped.source_url,
          last_scraped: scraped.last_scraped,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bill.id)
        .eq('team_id', team.id);
      refreshed++;
    } catch {
      // skip failed bills
    }
  }

  revalidatePath('/app/legislative');
  return { refreshed };
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

// ---- Monday.com ----

export async function pushBillToMondayAction(id: number) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };
  if (!isMondayConfigured()) return { error: 'MONDAY_API_TOKEN not configured' };

  const supabase = await createClient();
  const { data: bill } = await (supabase as any)
    .from('legislative_bills')
    .select('*')
    .eq('id', id)
    .eq('team_id', team.id)
    .single();

  if (!bill) return { error: 'Bill not found' };

  try {
    const item = await createBillItem({
      bill_id: bill.bill_id,
      title: bill.title,
      topic: bill.topic,
      house_location: bill.house_location,
      committee_location: bill.committee_location,
      source_url: bill.source_url,
      lead_authors: bill.lead_authors,
    });
    return { data: item };
  } catch (e: any) {
    return { error: `Monday.com error: ${e.message}` };
  }
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
