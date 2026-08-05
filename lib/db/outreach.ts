import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type OutreachStatus = 'need_outreach' | 'scheduling' | 'scheduled';

export interface OutreachQueueItem {
  id: number;
  team_id: number;
  user_id: number;
  contact_id: number;
  status: OutreachStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const FREQUENCY_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};

export async function getOutreachQueueForUser(
  userId: number,
  teamId: number,
): Promise<OutreachQueueItem[]> {
  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from('outreach_queue')
    .select('*')
    .eq('user_id', userId)
    .eq('team_id', teamId)
    .order('created_at', { ascending: true });
  return (data as OutreachQueueItem[]) || [];
}

export async function addToOutreachQueue(
  teamId: number,
  userId: number,
  contactId: number,
  status: OutreachStatus = 'need_outreach',
  notes?: string,
): Promise<OutreachQueueItem | null> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('outreach_queue')
    .upsert(
      {
        team_id: teamId,
        user_id: userId,
        contact_id: contactId,
        status,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,contact_id' },
    )
    .select()
    .single();
  if (error) return null;
  return data as OutreachQueueItem;
}

export async function updateOutreachStatus(
  id: number,
  teamId: number,
  status: OutreachStatus,
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from('outreach_queue')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('team_id', teamId);
  return !error;
}

export async function removeFromOutreachQueue(
  id: number,
  teamId: number,
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from('outreach_queue')
    .delete()
    .eq('id', id)
    .eq('team_id', teamId);
  return !error;
}

/** Remove all queue entries for a contact (e.g. when a 1-on-1 is logged). */
export async function completeOutreachForContact(
  contactId: number,
  teamId: number,
): Promise<void> {
  const supabase = createAdminClient();
  await (supabase as any)
    .from('outreach_queue')
    .delete()
    .eq('contact_id', contactId)
    .eq('team_id', teamId);
}

/** Get all active queue items for a team (used by Monday.com sync). */
export async function getOutreachQueueForTeam(
  teamId: number,
): Promise<OutreachQueueItem[]> {
  const supabase = createAdminClient();
  const { data } = await (supabase as any)
    .from('outreach_queue')
    .select('*')
    .eq('team_id', teamId)
    .order('user_id')
    .order('status')
    .order('created_at', { ascending: true });
  return (data as OutreachQueueItem[]) || [];
}

/**
 * Compute contacts that are overdue for outreach.
 * Returns contact IDs that have outreach_frequency set and whose last 1-on-1
 * exceeds the cadence, or priority contacts with no 1-on-1 history.
 */
export function computeOverdueContacts(
  contacts: Array<{
    id: number;
    outreach_frequency: string | null;
    engagement_level: string | null;
  }>,
  lastOneOnOneDates: Record<number, string>,
  queuedContactIds: Set<number>,
): Array<{ contactId: number; reason: string; daysOverdue: number }> {
  const now = Date.now();
  const suggestions: Array<{ contactId: number; reason: string; daysOverdue: number }> = [];

  for (const contact of contacts) {
    if (queuedContactIds.has(contact.id)) continue;

    const lastDate = lastOneOnOneDates[contact.id];
    const freq = contact.outreach_frequency;

    if (freq && FREQUENCY_DAYS[freq]) {
      const thresholdMs = FREQUENCY_DAYS[freq] * 24 * 60 * 60 * 1000;

      if (!lastDate) {
        // Has frequency set but no 1-on-1 ever
        suggestions.push({
          contactId: contact.id,
          reason: `${freq} cadence, no meetings yet`,
          daysOverdue: 999,
        });
      } else {
        const lastMs = new Date(lastDate).getTime();
        const elapsed = now - lastMs;
        if (elapsed > thresholdMs) {
          const daysOverdue = Math.floor((elapsed - thresholdMs) / (24 * 60 * 60 * 1000));
          suggestions.push({
            contactId: contact.id,
            reason: `${daysOverdue}d overdue (${freq})`,
            daysOverdue,
          });
        }
      }
    } else if (!lastDate) {
      // Priority contacts with no frequency set AND no 1-on-1 history
      const level = contact.engagement_level || 'potential';
      if (['activist', 'leader'].includes(level)) {
        suggestions.push({
          contactId: contact.id,
          reason: `${level === 'leader' ? 'Leader' : 'Activist'}, no meetings yet`,
          daysOverdue: 999,
        });
      }
    }
  }

  // Sort: most overdue first, then by reason
  suggestions.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return suggestions;
}
