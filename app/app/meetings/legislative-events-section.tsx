'use client';

import { useState, useTransition } from 'react';
import styles from '../legislative/legislative-dashboard.module.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  createEventAction,
  updateEventAction,
  deleteEventAction,
} from '../legislative/actions';

function cx(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

function getEventBadgeClass(urgency: string, badgeLabel?: string): string {
  if (badgeLabel && /floor/i.test(badgeLabel)) return styles.badgeFloor;
  if (urgency === 'deadline') return styles.badgeDeadline;
  if (urgency === 'planning') return styles.badgePlanning;
  if (urgency === 'urgent') return styles.badgeUrgent;
  if (urgency === 'soon') return styles.badgeSoon;
  return styles.badgeInfo;
}

function EventCard({ ev, onEdit, onDelete }: { ev: any; onEdit: () => void; onDelete: () => void }) {
  const d = new Date(ev.event_date + 'T00:00:00');
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const day = d.getDate().toString();

  return (
    <div className={cx(styles.eventCard, styles[ev.urgency])}>
      <div className={styles.eventDate}>
        <div className={styles.month}>{ev.date_label?.split(' ')[0] || month}</div>
        <div className={styles.day}>{ev.date_label?.split(' ').slice(1).join(' ') || day}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className={styles.eventTitle}>
          {ev.title}
          {ev.badge_label && (
            <span className={cx(styles.badge, getEventBadgeClass(ev.urgency, ev.badge_label))}>
              {ev.badge_label}
            </span>
          )}
        </div>
        <div className={styles.eventDesc}>{ev.description}</div>
      </div>
      <div className={styles.cardActions}>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function EventFormDialog({
  open,
  onOpenChange,
  event,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  event: any | null;
  onSave: (data: any) => void;
}) {
  const isEdit = !!event;
  const [form, setForm] = useState(event || {
    title: '', description: '', event_date: '', urgency: 'future',
    badge_label: '', event_type: 'event', date_label: '',
  });

  const set = (key: string, val: string) => setForm((p: any) => ({ ...p, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit event' : 'Add event'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea rows={2} value={form.description || ''} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" value={form.event_date} onChange={(e) => set('event_date', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Urgency</Label>
              <Select value={form.urgency || 'future'} onValueChange={(v) => set('urgency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="soon">Soon</SelectItem>
                  <SelectItem value="deadline">Deadline</SelectItem>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="future">Future</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.event_type || 'event'} onValueChange={(v) => set('event_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="calendar">Calendar milestone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Badge</Label>
              <Input placeholder="e.g. Deadline, Critical" value={form.badge_label || ''} onChange={(e) => set('badge_label', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Date label <span className="text-muted-foreground text-xs">(optional override)</span></Label>
            <Input placeholder="e.g. Aug 17–31" value={form.date_label || ''} onChange={(e) => set('date_label', e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={!form.title || !form.event_date}>
            {isEdit ? 'Save changes' : 'Add event'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function LegislativeEventsSection({ initialEvents }: { initialEvents: any[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [pending, startTransition] = useTransition();
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);

  const handleSaveEvent = (form: any) => {
    startTransition(async () => {
      if (editingEvent) {
        const res = await updateEventAction(editingEvent.id, form);
        if ('error' in res) { toast.error(res.error); return; }
        setEvents(prev => prev.map(e => e.id === editingEvent.id ? res.data : e));
        toast.success('Event updated');
      } else {
        const res = await createEventAction(form);
        if ('error' in res) { toast.error(res.error); return; }
        setEvents(prev => [...prev, res.data].sort((a: any, b: any) => a.event_date.localeCompare(b.event_date)));
        toast.success('Event added');
      }
      setEventDialogOpen(false);
      setEditingEvent(null);
    });
  };

  const handleDeleteEvent = (ev: any) => {
    if (!confirm(`Delete "${ev.title}"?`)) return;
    startTransition(async () => {
      const res = await deleteEventAction(ev.id);
      if ('error' in res) { toast.error(res.error); return; }
      setEvents(prev => prev.filter(e => e.id !== ev.id));
      toast.success('Event deleted');
    });
  };

  const calendarEvents = events.filter(e => e.event_type === 'calendar');
  const regularEvents = events.filter(e => e.event_type !== 'calendar');
  const urgentEvents = regularEvents.filter(e => e.urgency === 'urgent');
  const soonEvents = regularEvents.filter(e => e.urgency === 'soon');
  const otherEvents = regularEvents.filter(e => e.urgency !== 'urgent' && e.urgency !== 'soon');

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className={styles.sourceLine}>
          {events.length} event{events.length !== 1 ? 's' : ''} &amp; milestone{events.length !== 1 ? 's' : ''}
        </div>
        <Button
          size="sm"
          onClick={() => { setEditingEvent(null); setEventDialogOpen(true); }}
        >
          <Plus className="h-4 w-4 mr-2" /> Add event
        </Button>
      </div>

      {urgentEvents.length > 0 && (
        <>
          <div className={styles.sectionTitle}>Today / urgent</div>
          {urgentEvents.map((ev) => (
            <EventCard key={ev.id} ev={ev}
              onEdit={() => { setEditingEvent(ev); setEventDialogOpen(true); }}
              onDelete={() => handleDeleteEvent(ev)} />
          ))}
        </>
      )}
      {soonEvents.length > 0 && (
        <>
          <div className={styles.sectionTitle}>This week</div>
          {soonEvents.map((ev) => (
            <EventCard key={ev.id} ev={ev}
              onEdit={() => { setEditingEvent(ev); setEventDialogOpen(true); }}
              onDelete={() => handleDeleteEvent(ev)} />
          ))}
        </>
      )}
      {otherEvents.length > 0 && (
        <>
          <div className={styles.sectionTitle}>Upcoming</div>
          {otherEvents.map((ev) => (
            <EventCard key={ev.id} ev={ev}
              onEdit={() => { setEditingEvent(ev); setEventDialogOpen(true); }}
              onDelete={() => handleDeleteEvent(ev)} />
          ))}
        </>
      )}

      {calendarEvents.length > 0 && (
        <>
          <div className={styles.sectionTitle}>Legislative calendar</div>
          <table className={styles.calTable}>
            <tbody>
              <tr><th>Date</th><th>Milestone</th><th>Status</th><th></th></tr>
              {calendarEvents.map((row) => {
                const state = row.urgency === 'past' ? 'past' :
                  row.urgency === 'urgent' ? 'imm' :
                  row.urgency === 'soon' ? 'soon' : 'upc';
                return (
                  <tr key={row.id} className={styles[state]}>
                    <td>{row.date_label || row.event_date}</td>
                    <td><strong>{row.title}</strong></td>
                    <td>{row.description}</td>
                    <td className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground"
                          onClick={() => { setEditingEvent(row); setEventDialogOpen(true); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteEvent(row)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {events.length === 0 && (
        <p className="text-center text-muted-foreground py-12 text-sm">
          No events yet. Click &ldquo;Add event&rdquo; to create one.
        </p>
      )}

      <EventFormDialog
        key={editingEvent?.id ?? 'new-event'}
        open={eventDialogOpen}
        onOpenChange={(v) => { setEventDialogOpen(v); if (!v) setEditingEvent(null); }}
        event={editingEvent}
        onSave={handleSaveEvent}
      />
    </div>
  );
}
