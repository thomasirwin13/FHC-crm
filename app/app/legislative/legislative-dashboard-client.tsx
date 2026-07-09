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
import { Plus, Pencil, Trash2, RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  createBillAction,
  updateBillAction,
  deleteBillAction,
  refreshBillAction,
  refreshAllBillsAction,
  pushBillToMondayAction,
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

// ---- Bill Card ----

function BillCard({
  bill,
  onEdit,
  onDelete,
  onRefresh,
  onPushToMonday,
  refreshing,
  pushing,
}: {
  bill: any;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => void;
  onPushToMonday: () => void;
  refreshing: boolean;
  pushing: boolean;
}) {
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
          {bill.topic && (
            <span className={cx(styles.badge, styles.badgeInfo)}>{bill.topic}</span>
          )}
          {bill.badge_label && (
            <span className={cx(styles.badge, badgeClass[bill.alert_type] || styles.badgeInfo)}>{bill.badge_label}</span>
          )}
        </div>
        <div className={styles.cardActions}>
          <Button size="sm" variant="ghost" className={cx("h-7 w-7 p-0 text-muted-foreground", refreshing && "animate-spin")} onClick={onRefresh} disabled={refreshing} title="Refresh from leginfo">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={onPushToMonday} disabled={pushing} title="Push to Monday.com">
            <Send className={cx("h-3.5 w-3.5", pushing && "animate-pulse")} />
          </Button>
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
          ` · Hearing: ${new Date(bill.committee_hearing_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
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
        {bill.last_scraped && (
          <> · Updated {new Date(bill.last_scraped).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
        )}
      </div>
    </div>
  );
}

// ---- Add Bill Dialog (minimal: bill number, location, topic) ----

function AddBillDialog({
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (data: { bill_id: string; location: string; topic: string }) => void;
  saving: boolean;
}) {
  const [billId, setBillId] = useState('');
  const [location, setLocation] = useState('California');
  const [topic, setTopic] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Track a new bill</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Enter the bill number and we'll pull everything else from Open States.
        </p>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Bill number</Label>
            <Input placeholder="AB 1903" value={billId} onChange={(e) => setBillId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Location</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="California">California (state)</SelectItem>
                <SelectItem value="LA City">LA City</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Topic</Label>
            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger><SelectValue placeholder="Select topic..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Family housing">Family housing</SelectItem>
                <SelectItem value="Entry level rentals">Entry level rentals</SelectItem>
                <SelectItem value="General housing">General housing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave({ bill_id: billId, location, topic })} disabled={!billId || saving}>
            {saving ? 'Looking up...' : 'Track bill'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Edit Bill Dialog (manual overrides for alert, badge, letter status) ----

function EditBillDialog({
  open,
  onOpenChange,
  bill,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bill: any;
  onSave: (data: any) => void;
}) {
  const [form, setForm] = useState(bill);
  const set = (key: string, val: string) => setForm((p: any) => ({ ...p, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {bill.bill_id}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Topic</Label>
            <Select value={form.topic || ''} onValueChange={(v) => set('topic', v)}>
              <SelectTrigger><SelectValue placeholder="Select topic..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Family housing">Family housing</SelectItem>
                <SelectItem value="Entry level rentals">Entry level rentals</SelectItem>
                <SelectItem value="General housing">General housing</SelectItem>
              </SelectContent>
            </Select>
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
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave({
            topic: form.topic,
            alert_type: form.alert_type,
            highlight: form.highlight,
            badge_label: form.badge_label,
            alert_note: form.alert_note,
            letter_status: form.letter_status,
            letter_status_label: form.letter_status_label,
          })}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Main Component ----

export default function LegislativeDashboardClient({
  bills: initialBills,
}: {
  bills: any[];
}) {
  const [bills, setBills] = useState(initialBills);
  const [pending, startTransition] = useTransition();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<any | null>(null);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [pushingId, setPushingId] = useState<number | null>(null);

  const handleAddBill = (form: { bill_id: string; location: string; topic: string }) => {
    startTransition(async () => {
      const res = await createBillAction(form);
      if ('error' in res) { toast.error(res.error); return; }
      setBills(prev => [...prev, res.data]);
      toast.success('Bill added and data scraped from Open States');
      setAddDialogOpen(false);
    });
  };

  const handleEditBill = (form: any) => {
    if (!editingBill) return;
    startTransition(async () => {
      const res = await updateBillAction(editingBill.id, form);
      if ('error' in res) { toast.error(res.error); return; }
      setBills(prev => prev.map(b => b.id === editingBill.id ? res.data : b));
      toast.success('Bill updated');
      setEditDialogOpen(false);
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

  const handleRefreshBill = (bill: any) => {
    setRefreshingId(bill.id);
    startTransition(async () => {
      const res = await refreshBillAction(bill.id);
      setRefreshingId(null);
      if ('error' in res) { toast.error(res.error); return; }
      setBills(prev => prev.map(b => b.id === bill.id ? res.data : b));
      toast.success(`${bill.bill_id} refreshed`);
    });
  };

  const handlePushToMonday = (bill: any) => {
    setPushingId(bill.id);
    startTransition(async () => {
      const res = await pushBillToMondayAction(bill.id);
      setPushingId(null);
      if ('error' in res) { toast.error(res.error); return; }
      toast.success(`${bill.bill_id} pushed to Monday.com`);
    });
  };

  const handleRefreshAll = () => {
    setRefreshingAll(true);
    startTransition(async () => {
      const res = await refreshAllBillsAction();
      setRefreshingAll(false);
      if ('error' in res) { toast.error(res.error); return; }
      toast.success(`${res.refreshed} bill${res.refreshed === 1 ? '' : 's'} refreshed`);
      window.location.reload();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className={styles.sourceLine}>
          {bills.length} bill{bills.length !== 1 ? 's' : ''} tracked
        </div>
        <div className="flex gap-2">
          {bills.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleRefreshAll} disabled={refreshingAll || pending}>
              <RefreshCw className={cx("h-4 w-4 mr-2", refreshingAll && "animate-spin")} />
              {refreshingAll ? 'Refreshing...' : 'Refresh all'}
            </Button>
          )}
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Track bill
          </Button>
        </div>
      </div>
      {bills.map((bill) => (
        <BillCard
          key={bill.id}
          bill={bill}
          onEdit={() => { setEditingBill(bill); setEditDialogOpen(true); }}
          onDelete={() => handleDeleteBill(bill)}
          onRefresh={() => handleRefreshBill(bill)}
          onPushToMonday={() => handlePushToMonday(bill)}
          refreshing={refreshingId === bill.id}
          pushing={pushingId === bill.id}
        />
      ))}
      {bills.length === 0 && (
        <p className="text-center text-muted-foreground py-12 text-sm">
          No bills tracked yet. Click &ldquo;Track bill&rdquo; to add one.
        </p>
      )}

      <AddBillDialog
        key={addDialogOpen ? 'add' : 'closed'}
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSave={handleAddBill}
        saving={pending}
      />
      {editingBill && (
        <EditBillDialog
          key={editingBill.id}
          open={editDialogOpen}
          onOpenChange={(v) => { setEditDialogOpen(v); if (!v) setEditingBill(null); }}
          bill={editingBill}
          onSave={handleEditBill}
        />
      )}
    </div>
  );
}
