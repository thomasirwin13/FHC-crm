'use client';

import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Megaphone,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Users,
  Search,
  FileText,
  Mail,
  PenLine,
  Trash2,
  Download,
  RotateCcw,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  getActionNetworkParticipationAction,
  dismissActionNetworkActionAction,
  restoreActionNetworkActionAction,
  importActionNetworkActionsAction,
  type ANParticipationResult,
  type ANActionParticipation,
  type ANActionType,
  type DismissedAction,
} from './action-network-participation-action';

const TYPE_ICON: Record<ANActionType, React.ReactNode> = {
  petition: <PenLine className="h-4 w-4" />,
  form: <FileText className="h-4 w-4" />,
  advocacy_campaign: <Mail className="h-4 w-4" />,
};

const TYPE_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All actions' },
  { value: 'petition', label: 'Petitions' },
  { value: 'advocacy_campaign', label: 'Letters / emails' },
  { value: 'form', label: 'Forms / letters' },
];

const keyOf = (a: { type: ANActionType; id: string }) => `${a.type}-${a.id}`;

export default function ActionNetworkParticipation({ configured }: { configured: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const [pending, startTransition] = useTransition();
  const [importing, setImporting] = useState(false);
  const [data, setData] = useState<ANParticipationResult | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [openAction, setOpenAction] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);

  const load = () => {
    startTransition(async () => {
      const res = await getActionNetworkParticipationAction();
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      setData(res.result);
      setSelected(new Set());
      setLoaded(true);
    });
  };

  const filteredActions = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase().trim();
    return data.actions
      .filter((a) => typeFilter === 'all' || a.type === typeFilter)
      .filter((a) => !q || a.title.toLowerCase().includes(q));
  }, [data, typeFilter, search]);

  const toggleSelect = (a: ANActionParticipation) => {
    const k = keyOf(a);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const allVisibleSelected = filteredActions.length > 0 && filteredActions.every((a) => selected.has(keyOf(a)));
  const toggleSelectAll = () => {
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        for (const a of filteredActions) next.delete(keyOf(a));
        return next;
      }
      const next = new Set(prev);
      for (const a of filteredActions) next.add(keyOf(a));
      return next;
    });
  };

  const handleDelete = (a: ANActionParticipation) => {
    // Optimistically remove from the list; add to the hidden set.
    setData((prev) =>
      prev
        ? {
            ...prev,
            actions: prev.actions.filter((x) => keyOf(x) !== keyOf(a)),
            dismissed: [...prev.dismissed, { id: a.id, type: a.type, title: a.title }],
          }
        : prev
    );
    setSelected((prev) => { const n = new Set(prev); n.delete(keyOf(a)); return n; });
    startTransition(async () => {
      const res = await dismissActionNetworkActionAction({ id: a.id, type: a.type, title: a.title });
      if ('error' in res) { toast.error(res.error); load(); return; }
      toast.success('Action hidden');
    });
  };

  const handleRestore = (d: DismissedAction) => {
    setData((prev) => prev ? { ...prev, dismissed: prev.dismissed.filter((x) => x.id !== d.id) } : prev);
    startTransition(async () => {
      const res = await restoreActionNetworkActionAction(d.id);
      if ('error' in res) { toast.error(res.error); return; }
      toast.success('Action restored');
      load(); // refetch so the restored action reappears with fresh counts
    });
  };

  const handleImport = () => {
    if (!data || selected.size === 0) return;
    const chosen = data.actions
      .filter((a) => selected.has(keyOf(a)))
      .map((a) => ({ id: a.id, type: a.type, title: a.title }));
    setImporting(true);
    startTransition(async () => {
      const res = await importActionNetworkActionsAction(chosen);
      setImporting(false);
      if ('error' in res) { toast.error(res.error); return; }
      const { contactsCreated, participantsTagged } = res.result;
      toast.success(
        `Imported ${chosen.length} action${chosen.length !== 1 ? 's' : ''} · ` +
          `${contactsCreated} new contact${contactsCreated !== 1 ? 's' : ''}, ${participantsTagged} tagged`
      );
      load(); // refresh matched counts
    });
  };

  return (
    <Card className="border-border/50 p-4 space-y-4 mb-6">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Megaphone className="h-5 w-5" /> Action Network participation
        </h2>
        {expanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Track how many people — and exactly who — took action through petitions,
            letters, and emails in your Action Network account. Select actions to import
            their participants into the CRM, or hide ones you don&rsquo;t want to track.
          </p>

          {!configured ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
              Action Network isn&rsquo;t connected yet. Add your API key in{' '}
              <a href="/settings/integrations" className="underline font-medium">
                Settings &rarr; Integrations
              </a>.
            </div>
          ) : !loaded ? (
            <Button onClick={load} disabled={pending}>
              {pending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Pulling participation…</>
              ) : (
                <><Megaphone className="h-4 w-4 mr-2" /> Load participation from Action Network</>
              )}
            </Button>
          ) : data ? (
            <div className="space-y-4">
              {/* Summary tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatTile label="Actions" value={data.totals.actions} />
                <StatTile label="Total participations" value={data.totals.participations} />
                <StatTile label="Unique people" value={data.totals.uniquePeople} />
                <StatTile label="Already in CRM" value={data.totals.matched} />
              </div>

              {data.capped && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Some records were capped by Action Network limits — a few actions or
                  participants may be missing.
                </p>
              )}

              {/* Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search actions..."
                    className="h-8 text-xs pl-8"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_FILTERS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={load} disabled={pending || importing}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${pending ? 'animate-spin' : ''}`} /> Refresh
                </Button>
              </div>

              {/* Selection / import bar */}
              {filteredActions.length > 0 && (
                <div className="flex items-center justify-between gap-2 flex-wrap rounded-md border border-border/50 bg-muted/20 px-3 py-2">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                    />
                    {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
                  </label>
                  <Button size="sm" onClick={handleImport} disabled={selected.size === 0 || importing || pending}>
                    {importing ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Importing…</>
                    ) : (
                      <><Download className="h-3.5 w-3.5 mr-1.5" /> Import selected{selected.size > 0 ? ` (${selected.size})` : ''}</>
                    )}
                  </Button>
                </div>
              )}

              {/* Action list */}
              {filteredActions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No actions with participants match the current filters.
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredActions.map((action) => (
                    <ActionRow
                      key={keyOf(action)}
                      action={action}
                      selected={selected.has(keyOf(action))}
                      onToggleSelect={() => toggleSelect(action)}
                      onDelete={() => handleDelete(action)}
                      open={openAction === keyOf(action)}
                      onToggleOpen={() =>
                        setOpenAction((prev) => (prev === keyOf(action) ? null : keyOf(action)))
                      }
                    />
                  ))}
                </div>
              )}

              {/* Hidden actions */}
              {data.dismissed.length > 0 && (
                <div className="pt-1">
                  <button
                    onClick={() => setShowHidden((v) => !v)}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    {data.dismissed.length} hidden {data.dismissed.length === 1 ? 'action' : 'actions'} · {showHidden ? 'hide' : 'show'}
                  </button>
                  {showHidden && (
                    <div className="mt-2 rounded-md border border-border/50 bg-muted/20 divide-y divide-border/30">
                      {data.dismissed.map((d) => (
                        <div key={d.id} className="flex items-center gap-2 px-3 py-1.5">
                          <div className="flex-1 min-w-0 text-sm truncate text-muted-foreground">{d.title}</div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => handleRestore(d)}
                            disabled={pending}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/50 p-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

function ActionRow({
  action,
  selected,
  onToggleSelect,
  onDelete,
  open,
  onToggleOpen,
}: {
  action: ANActionParticipation;
  selected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  open: boolean;
  onToggleOpen: () => void;
}) {
  return (
    <div className="rounded-md border border-border/50">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 rounded shrink-0"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select ${action.title}`}
        />
        <button
          onClick={onToggleOpen}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <span className="text-muted-foreground shrink-0">{TYPE_ICON[action.type]}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{action.title}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span>{action.typeLabel}</span>
              {action.date && (
                <>
                  <span>·</span>
                  <span>{format(new Date(action.date + 'T00:00:00'), 'MMM d, yyyy')}</span>
                </>
              )}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            {action.total.toLocaleString()}
          </Badge>
          {action.matched > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-blue-500/30 text-blue-500">
              {action.matched} in CRM
            </Badge>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            title="Hide this action"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <button onClick={onToggleOpen} className="text-muted-foreground">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="px-3 pb-3">
          {action.participants.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              Participant details unavailable for this action.
            </p>
          ) : (
            <>
              <div className="max-h-72 overflow-y-auto rounded-md border border-border/50 bg-muted/20 divide-y divide-border/30">
                {action.participants.map((p) => (
                  <div key={p.anId} className="flex items-center gap-2 px-3 py-1.5">
                    <div className="flex-1 min-w-0">
                      {p.contactId ? (
                        <Link
                          href={`/app/contacts/${p.contactId}`}
                          className="text-sm font-medium hover:underline underline-offset-2 truncate block"
                        >
                          {p.name || p.email || '(no name)'}
                        </Link>
                      ) : (
                        <div className="text-sm truncate">{p.name || p.email || '(no name)'}</div>
                      )}
                      {p.email && p.name && (
                        <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                      )}
                    </div>
                    {p.contactId ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-blue-500/30 text-blue-500 shrink-0">
                        In CRM
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-violet-500/30 text-violet-500 shrink-0">
                        Not in CRM
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
              {action.resolved < action.total && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Showing {action.participants.length.toLocaleString()} of {action.total.toLocaleString()} participants
                  {' '}(some could not be resolved to a person record).
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
