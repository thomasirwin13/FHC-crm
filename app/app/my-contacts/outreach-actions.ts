'use server';

import { revalidatePath } from 'next/cache';
import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';
import {
  addToOutreachQueue,
  updateOutreachStatus,
  removeFromOutreachQueue,
  type OutreachStatus,
} from '@/lib/db/outreach';

export async function addToQueueAction(contactId: number, status: OutreachStatus = 'need_outreach') {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const item = await addToOutreachQueue(team.id, user.id, contactId, status);
  if (!item) return { error: 'Failed to add to queue' };

  revalidatePath('/app/my-contacts');
  return { success: true };
}

export async function updateQueueStatusAction(id: number, status: OutreachStatus) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const ok = await updateOutreachStatus(id, team.id, status);
  if (!ok) return { error: 'Failed to update status' };

  revalidatePath('/app/my-contacts');
  return { success: true };
}

export async function removeFromQueueAction(id: number) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const ok = await removeFromOutreachQueue(id, team.id);
  if (!ok) return { error: 'Failed to remove from queue' };

  revalidatePath('/app/my-contacts');
  return { success: true };
}

export async function syncToMondayAction() {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const { resolveMonday } = await import('@/lib/integrations');
  const monday = await resolveMonday(team.id);
  if (!monday.apiToken) return { error: 'Monday.com is not connected. Configure it in Settings → Integrations.' };

  const { getOutreachQueueForUser } = await import('@/lib/db/outreach');
  const items = await getOutreachQueueForUser(user.id, team.id);
  if (items.length === 0) return { error: 'No contacts in your outreach queue' };

  const { getContactById } = await import('@/lib/db/supabase-queries');
  const contactNames: string[] = [];
  for (const item of items) {
    const contact = await getContactById(item.contact_id, team.id);
    contactNames.push(contact?.name || `Contact #${item.contact_id}`);
  }

  const { createMondayClient } = await import('@/lib/monday');
  const client = createMondayClient(monday.apiToken, monday.boardId);

  const weekStart = getWeekStart();
  const itemName = `Week of ${weekStart} — Outreach (${items.length} contact${items.length !== 1 ? 's' : ''})`;
  const body = contactNames.map((n, i) => `${i + 1}. ${n}`).join('\n');

  try {
    await client.createOutreachTask({ title: itemName, body, contactCount: items.length });
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to create Monday.com task' };
  }
}

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
