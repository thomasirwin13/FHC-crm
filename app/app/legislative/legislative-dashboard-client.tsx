'use client';

import { useState, useTransition } from 'react';
import styles from './legislative-dashboard.module.css';
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
  createBillAction,
  updateBillAction,
  deleteBillAction,
  createEventAction,
  updateEventAction,
  deleteEventAction,
} from './actions';

function cx(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

function daysSince(dateLike: string | Date | null | undefined): number | null {
  if (!dateLike) return null;
  const then = typeof dateLike === 'string' ? new Date(dateLike) : dateLike;
  if (Number.isNaN(then.getTime())) return null;
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(then.getFullYear(), then.getMonth(), then.getDate())) / msPerDay
  );
}

function parseMmDdYy(s: string | undefined): Date | null {
  if (!s) return null;
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{2})/);
  if (!m) return null;
  const [, mm, dd, yy] = m;
  return new Date(2000 + Number(yy), Number(mm) - 1, Number(dd));
}

type BillAlertType = 'floor' | 'good' | 'today' | 'canceled' | 'none';

const alertClass: Record<string, string | undefined> = {
  floor: styles.floorAlert,
  good: styles.goodAlert,
  today: styles.todayAlert,
  canceled: styles.canceledAlert,
  none: undefined,
};
const badgeClass: Record<string, string> = {
  floor: styles.badgeFloor,
  good: styles.badgeDone,
  today: styles.badgeUrgent,
  canceled: styles.badgeCanceled,
  none: styles.badgeInfo,
};
const stageClass: Record<string, string> = {
  done: styles.done,
  active: styles.active,
  'active-today': styles.activeToday,
  'floor-now': styles.floorNow,
  future: styles.future,
  canceled: styles.canceledStage,
};

const TABS = [
  { id: 'bills', label: 'Bills' },
  { id: 'events', label: 'Events & calendar' },
] as const;

type TabId = typeof TABS[number]['id'];

// ---- Bill Card ----

function BillCard({ bill, onEdit, onDelete }: { bill: any; onEdit: () => void; onDelete: () => void }) {
  const historyActions = (bill.history_actions || []) as { date: string; action: string }[];
  const stages = (bill.stages || []) as { label: string; status: string }[];
  const mostRecentAction = parseMmDdYy(historyActions[0]?.date);
  const daysSinceAction = daysSince(mostRecentAction);
  const daysPastDeadline = daysSince(bill.policy_deadline);

  return (
    <div
      className={cx(
        styles.billCard,
        bill.highlight === 'imminent' && styles.imminent,
        bill.highlight === 'canceled' && styles.canceledCard
      )}
    >
      <div className={styles.billHeader}>
        <div className="flex items-center gap-2">
          <span className={styles.billId}>{bill.bill_id}</span>
          <span className={cx(styles.badge, badgeClass[bill.alert_type] || styles.badgeInfo)}>{bill.badge_label}</span>
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
      <div className={styles.billTitle}>{bill.title}</div>
      <div className={styles.billStatusLine}>
        {bill.house_location} &middot; {bill.committee_location || 'Floor'}
        {bill.committee_hearing_date &&
          ` · Hearing: ${new Date(bill.committee_hearing_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
      </div>
      {historyActions.length > 0 && (
        <div className={styles.billLastAction}>
          {historyActions.slice(0, 3).map((a, i) => (
            <span key={i}>
              {i > 0 && '  |  '}
              {a.date} &mdash; {a.action}
            </span>
          ))}
        </div>
      )}
      {stages.length > 0 && (
        <div className={styles.progressTrack}>
          {stages.map((stage, i) => (
            <div key={i} className={cx(styles.stage, stageClass[stage.status])}>
              {stage.status === 'done' && '✓ '}
              {stage.label}
            </div>
          ))}
        </div>
      )}
      {bill.alert_note && (
        <div className={cx(styles.hearingAlert, alertClass[bill.alert_type])}>
          {bill.alert_note}
          {daysSinceAction !== null && daysSinceAction > 0 && (
            <> Last action was {daysSinceAction} day{daysSinceAction === 1 ? '' : 's'} ago.</>
          )}
          {daysPastDeadline !== null && daysPastDeadline > 0 && (bill.highlight === 'imminent' || bill.highlight === 'canceled') && (
            <> Now {daysPastDeadline} day{daysPastDeadline === 1 ? '' : 's'} past the 2nd-house policy deadline.</>
          )}
        </div>
      )}
      <div className={styles.leginfoSource}>
        {[bill.lead_authors, bill.principal_coauthors, bill.coauthors].filter(Boolean).join(' · ')}
        {bill.source_url && (
          <> · <a href={bill.source_url} target="_blank" rel="noreferrer">leginfo →</a></>
        )}
      </div>
    </div>
  );
}

// ---- Event Card ----

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

// ---- Add/Edit Bill Dialog ----

function BillFormDialog({
  open,
  onOpenChange,
  bill,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bill: any | null;
  onSave: (data: any) => void;
}) {
  const isEdit = !!bill;
  const [form, setForm] = useState(bill || {
    bill_id: '', title: '', topic: '', tier: 'Tier 2',
    house_location: '', committee_location: '',
    alert_type: 'none', alert_note: '', badge_label: '',
    highlight: 'none', source_url: '', letter_status: 'not_started',
    letter_status_label: 'Not submitted', letter_notes: '',
  });

  const set = (key: string, val: string) => setForm((p: any) => ({ ...p, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit bill' : 'Track a new bill'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Bill ID</Label>
              <Input placeholder="AB-1234" value={form.bill_id} onChange={(e) => set('bill_id', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tier</Label>
              <Select value={form.tier} onValueChange={(v) => set('tier', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tier 1">Tier 1</SelectItem>
                  <SelectItem value="Tier 2">Tier 2</SelectItem>
                  <SelectItem value="Tier 3">Tier 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Topic</Label>
            <Input value={form.topic || ''} onChange={(e) => set('topic', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>House location</Label>
              <Input placeholder="Assembly / Senate" value={form.house_location || ''} onChange={(e) => set('house_location', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Committee</Label>
              <Input value={form.committee_location || ''} onChange={(e) => set('committee_location', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Alert type</Label>
              <Select value={form.alert_type || 'none'} onValueChange={(v) => set('alert_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="floor">Floor vote</SelectItem>
                  <SelectItem value="good">Good news</SelectItem>
                  <SelectItem value="today">Today / urgent</SelectItem>
                  <SelectItem value="canceled">Canceled / dead</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Highlight</Label>
              <Select value={form.highlight || 'none'} onValueChange={(v) => set('highlight', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="imminent">Imminent</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Badge label</Label>
            <Input placeholder="e.g. Senate 3rd Reading" value={form.badge_label || ''} onChange={(e) => set('badge_label', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Alert note</Label>
            <Textarea rows={2} value={form.alert_note || ''} onChange={(e) => set('alert_note', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Letter status</Label>
              <Select value={form.letter_status || 'not_started'} onValueChange={(v) => set('letter_status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not started</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Letter status label</Label>
              <Input value={form.letter_status_label || ''} onChange={(e) => set('letter_status_label', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Source URL</Label>
            <Input placeholder="https://leginfo.legislature.ca.gov/..." value={form.source_url || ''} onChange={(e) => set('source_url', e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={!form.bill_id || !form.title}>
            {isEdit ? 'Save changes' : 'Add bill'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Add/Edit Event Dialog ----

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

// ---- Main Component ----

export default function LegislativeDashboardClient({
  bills: initialBills,
  events: initialEvents,
}: {
  bills: any[];
  events: any[];
}) {
  const [tab, setTab] = useState<TabId>('bills');
  const [bills, setBills] = useState(initialBills);
  const [events, setEvents] = useState(initialEvents);
  const [pending, startTransition] = useTransition();

  // Bill dialog state
  const [billDialogOpen, setBillDialogOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<any | null>(null);

  // Event dialog state
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);

  const handleSaveBill = (form: any) => {
    startTransition(async () => {
      if (editingBill) {
        const res = await updateBillAction(editingBill.id, form);
        if ('error' in res) { toast.error(res.error); return; }
        setBills(prev => prev.map(b => b.id === editingBill.id ? res.data : b));
        toast.success('Bill updated');
      } else {
        const res = await createBillAction(form);
        if ('error' in res) { toast.error(res.error); return; }
        setBills(prev => [...prev, res.data]);
        toast.success('Bill added');
      }
      setBillDialogOpen(false);
      setEditingBill(null);
    });
  };

  const handleDeleteBill = (bill: any) => {
    if (!confirm(`Remove ${bill.bill_id} from tracking?`)) return;
    startTransition(async () => {
      const res = await deleteBillAction(bill.id);
      if ('error' in res) { toast.error(res.error); return; }
      setBills(prev => prev.filter(b => b.id !== bill.id));
      toast.success('Bill removed');
    });
  };

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
        setEvents(prev => [...prev, res.data].sort((a, b) => a.event_date.localeCompare(b.event_date)));
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
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Bills tab */}
      {tab === 'bills' && (
        <div className={styles.tabContent}>
          <div className="flex items-center justify-between mb-4">
            <div className={styles.sourceLine}>
              {bills.length} bill{bills.length !== 1 ? 's' : ''} tracked
            </div>
            <Button
              size="sm"
              onClick={() => { setEditingBill(null); setBillDialogOpen(true); }}
            >
              <Plus className="h-4 w-4 mr-2" /> Track bill
            </Button>
          </div>
          {bills.map((bill) => (
            <BillCard
              key={bill.id}
              bill={bill}
              onEdit={() => { setEditingBill(bill); setBillDialogOpen(true); }}
              onDelete={() => handleDeleteBill(bill)}
            />
          ))}
          {bills.length === 0 && (
            <p className="text-center text-muted-foreground py-12 text-sm">
              No bills tracked yet. Click &ldquo;Track bill&rdquo; to add one.
            </p>
          )}
        </div>
      )}

      {/* Events tab */}
      {tab === 'events' && (
        <div className={styles.tabContent}>
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
        </div>
      )}

      {/* Dialogs */}
      <BillFormDialog
        key={editingBill?.id ?? 'new-bill'}
        open={billDialogOpen}
        onOpenChange={(v) => { setBillDialogOpen(v); if (!v) setEditingBill(null); }}
        bill={editingBill}
        onSave={handleSaveBill}
      />
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
