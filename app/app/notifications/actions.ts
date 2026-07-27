'use server';

import { getUser } from '@/lib/db/supabase-queries';
import {
  getNotificationsForUser,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/db/notifications';

export async function getNotificationsAction() {
  const user = await getUser();
  if (!user) return { notifications: [], unreadCount: 0 };

  const [notifications, unreadCount] = await Promise.all([
    getNotificationsForUser(30),
    getUnreadCount(),
  ]);

  return { notifications, unreadCount };
}

export async function markReadAction(notificationId: number) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  await markNotificationRead(notificationId);
  return { success: true };
}

export async function markAllReadAction() {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  await markAllNotificationsRead(user.id);
  return { success: true };
}
