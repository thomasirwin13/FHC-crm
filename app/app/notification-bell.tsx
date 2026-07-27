'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { Bell, Check, CheckCheck, UserPlus, Users, Calendar } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getNotificationsAction, markReadAction, markAllReadAction } from './notifications/actions';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import type { Notification } from '@/lib/db/notifications';

const TYPE_ICONS: Record<string, typeof Bell> = {
  one_on_one_logged: Calendar,
  one_on_one_reminder: Calendar,
  contact_created: UserPlus,
};

export default function NotificationBell({ isCollapsed }: { isCollapsed?: boolean }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const refresh = useCallback(async () => {
    const result = await getNotificationsAction();
    setNotifications(result.notifications);
    setUnreadCount(result.unreadCount);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleMarkRead = (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    startTransition(async () => { await markReadAction(id); });
  };

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    startTransition(async () => { await markAllReadAction(); });
  };

  const handleClick = (n: Notification) => {
    if (!n.read) handleMarkRead(n.id);
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'relative flex items-center rounded-lg text-sm font-medium transition-all text-muted-foreground hover:text-foreground hover:bg-accent',
            isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
          )}
        >
          <Bell className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && <span>Notifications</span>}
          {unreadCount > 0 && (
            <span className={cn(
              'absolute flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[18px] h-[18px] px-1',
              isCollapsed ? 'top-0.5 right-0.5' : 'top-1 left-5'
            )}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        className="w-80 p-0 max-h-[70vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>
        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = TYPE_ICONS[n.type] || Bell;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent border-b border-border/50 last:border-0',
                    !n.read && 'bg-accent/50'
                  )}
                >
                  <div className={cn(
                    'mt-0.5 flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center',
                    !n.read ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm', !n.read && 'font-medium')}>{n.title}</p>
                    {n.message && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.read && (
                    <div className="mt-2 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
