import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type NotificationType = 'one_on_one_logged' | 'one_on_one_reminder' | 'contact_created';

export interface Notification {
  id: number;
  team_id: number;
  user_id: number;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export async function getNotificationsForUser(limit = 20): Promise<Notification[]> {
  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as Notification[]) || [];
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await (supabase as any)
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('read', false);
  return count ?? 0;
}

export async function markNotificationRead(notificationId: number): Promise<void> {
  const supabase = await createClient();
  await (supabase as any)
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);
}

export async function markAllNotificationsRead(userId: number): Promise<void> {
  const supabase = await createClient();
  await (supabase as any)
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
}

export async function createNotification(params: {
  teamId: number;
  userId: number;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
}): Promise<void> {
  const supabase = createAdminClient();
  await (supabase as any).from('notifications').insert({
    team_id: params.teamId,
    user_id: params.userId,
    type: params.type,
    title: params.title,
    message: params.message || null,
    link: params.link || null,
  });
}

export async function notifyTeamMembers(params: {
  teamId: number;
  excludeUserId: number;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const { data: members } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', params.teamId);

  if (!members) return;

  const rows = members
    .filter((m: any) => m.user_id !== params.excludeUserId)
    .map((m: any) => ({
      team_id: params.teamId,
      user_id: m.user_id,
      type: params.type,
      title: params.title,
      message: params.message || null,
      link: params.link || null,
    }));

  if (rows.length > 0) {
    await (supabase as any).from('notifications').insert(rows);
  }
}

export async function notifyContactOrganizers(params: {
  teamId: number;
  contactId: number;
  excludeUserId: number;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const { data: organizers } = await supabase
    .from('contact_organizers')
    .select('user_id')
    .eq('contact_id', params.contactId)
    .eq('team_id', params.teamId);

  if (!organizers) return;

  const rows = organizers
    .filter((o: any) => o.user_id !== params.excludeUserId)
    .map((o: any) => ({
      team_id: params.teamId,
      user_id: o.user_id,
      type: params.type,
      title: params.title,
      message: params.message || null,
      link: params.link || null,
    }));

  if (rows.length > 0) {
    await (supabase as any).from('notifications').insert(rows);
  }
}
