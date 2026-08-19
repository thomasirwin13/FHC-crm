'use client';

import { useState, useMemo, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw, Loader2, ArrowDownToLine, ArrowUpFromLine, Check, Plus, Search,
  FileSignature, CalendarCheck, AlertTriangle,
} from 'lucide-react';
import {
  previewActionNetworkAction,
  syncActionNetworkAction,
  pushToActionNetworkAction,
  type PreviewPerson,
  type ActionNetworkSyncResult,
  type ActionNetworkPushResult,
} from './action-network-sync-action';
import { toast } from 'sonner';

interface Props {
  configured: boolean;
}

type DialogState = 'idle' | 'preview' | 'synced';

export default function ActionNetworkSyncDialog({ configured }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<DialogState>('idle');

  // Preview state
  const [previewPeople, setPreviewPeople] = useState<PreviewPerson[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [previewCapped, setPreviewCapped] = useState(false);

  // Sync result state
  const [result, setResult] = useState<ActionNetworkSyncResult | null>(null);
  const [pushResult, setPushResult] = useState<ActionNetworkPushResult | null>(null);

  const resetState = () => {
    setState('idle');
    setPreviewPeople([]);
    setSelectedEmails(new Set());
    setSearch('');
    setPreviewCapped(false);
    setResult(null);
    setPushResult(null);
  };

  const runPreview = () => {
    resetState();
    startTransition(async () => {
      const res = await previewActionNetworkAction();
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      const people = res.result.people;
      setPreviewPeople(people);
      setPreviewCapped(res.result.capped);
      // Select all non-synced by default
      const defaultSelected = new Set(
        people.filter((p) => p.status !== 'already_synced').map((p) => p.email.toLowerCase().trim())
      );
      setSelectedEmails(defaultSelected);
      setState('preview');
    });
  };

  const runSync = () => {
    startTransition(async () => {
      const emails = Array.from(selectedEmails);
      const res = await syncActionNetworkAction(emails.length > 0 ? emails : undefined);
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      setResult(res.result);
      setState('synced');
      toast.success('Action Network sync complete');
    });
  };

  const confirmPush = () => {
    if (!result) return;
    const ids = result.pendingPush.map((c) => c.id);
    startTransition(async () => {
      const res = await pushToActionNetworkAction(ids);
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      setPushResult(res.result);
      toast.success(`Pushed ${res.result.pushed} contact${res.result.pushed !== 1 ? 's' : ''} to Action Network`);
    });
  };

  // Filtered + categorized preview list
  const { filteredPeople, selectableCount, newCount, existingCount, syncedCount } = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = q
      ? previewPeople.filter(
          (p) =>
            p.email.toLowerCase().includes(q) ||
            (p.name && p.name.toLowerCase().includes(q))
        )
      : previewPeople;
    return {
      filteredPeople: filtered,
      selectableCount: previewPeople.filter((p) => p.status !== 'already_synced').length,
      newCount: previewPeople.filter((p) => p.status === 'new').length,
      existingCount: previewPeople.filter((p) => p.status === 'existing').length,
      syncedCount: previewPeople.filter((p) => p.status === 'already_synced').length,
    };
  }, [previewPeople, search]);

  const toggleEmail = (email: string) => {
    const key = email.toLowerCase().trim();
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedEmails(
      new Set(previewPeople.filter((p) => p.status !== 'already_synced').map((p) => p.email.toLowerCase().trim()))
    );
  };

  const deselectAll = () => setSelectedEmails(new Set());

  const petitionTags = result?.petitions.filter((p) => p.tagged > 0) ?? [];
  const eventTags = result?.events.filter((e) => e.tagged > 0) ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetState();
      }}
    >
      <Button
        variant="outline"
        size="sm"
        className="flex-shrink-0"
        onClick={() => setOpen(true)}
      >
        <RefreshCw className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">Action Network</span>
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sync with Action Network</DialogTitle>
          <DialogDescription>
            {state === 'preview'
              ? 'Select which people to sync. Uncheck any you want to exclude.'
              : 'Pull activists from Action Network and choose which to sync.'}
          </DialogDescription>
        </DialogHeader>

        {!configured ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
            Action Network isn&rsquo;t connected yet. Add your team&rsquo;s API key in{' '}
            <a href="/settings/integrations" className="underline font-medium">
              Settings &rarr; Integrations
            </a>.
            Find the key in Action Network under Start Organizing &rarr; Details &rarr; API &amp; Sync.
          </div>
        ) : state === 'preview' ? (
          <div className="space-y-3">
            {previewCapped && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Some records were capped. Run the sync again after this to pull the rest.</span>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Select all / none + counts */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <button onClick={selectAll} className="hover:text-foreground transition-colors underline">
                  Select all ({selectableCount})
                </button>
                <span>·</span>
                <button onClick={deselectAll} className="hover:text-foreground transition-colors underline">
                  Deselect all
                </button>
              </div>
              <div className="flex items-center gap-2">
                {newCount > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-violet-500/30 text-violet-500">{newCount} new</Badge>}
                {existingCount > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/30 text-blue-500">{existingCount} existing</Badge>}
                {syncedCount > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{syncedCount} synced</Badge>}
              </div>
            </div>

            {/* People list */}
            <div className="max-h-72 overflow-y-auto rounded-md border border-border/50 bg-muted/20 divide-y divide-border/30">
              {filteredPeople.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {search ? 'No contacts match your search.' : 'No people found.'}
                </div>
              ) : (
                filteredPeople.map((person) => {
                  const key = person.email.toLowerCase().trim();
                  const isSynced = person.status === 'already_synced';
                  const isSelected = selectedEmails.has(key);
                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors ${
                        isSynced ? 'opacity-50 cursor-default' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSynced ? false : isSelected}
                        disabled={isSynced}
                        onChange={() => toggleEmail(person.email)}
                        className="h-3.5 w-3.5 rounded shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{person.name || person.email}</div>
                        {person.name && (
                          <div className="text-xs text-muted-foreground truncate">{person.email}</div>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${
                          person.status === 'new'
                            ? 'border-violet-500/30 text-violet-500'
                            : person.status === 'existing'
                            ? 'border-blue-500/30 text-blue-500'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {person.status === 'new' ? 'New' : person.status === 'existing' ? 'Will tag' : 'Synced'}
                      </Badge>
                    </label>
                  );
                })
              )}
            </div>

            {/* Selection count */}
            <p className="text-xs text-muted-foreground">
              {selectedEmails.size} contact{selectedEmails.size !== 1 ? 's' : ''} selected
            </p>
          </div>
        ) : state === 'synced' && result ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-emerald-500">
              <Check className="h-4 w-4" /> Sync complete
            </div>
            <div className="rounded-md border border-border/50 divide-y divide-border/30">
              <ResultRow icon={<ArrowDownToLine className="h-4 w-4 text-blue-500" />} label="Newly tagged from Action Network" value={result.pulled} />
              <ResultRow label="Already tagged" value={result.alreadyTagged} muted />
              <ResultRow icon={<Plus className="h-4 w-4 text-violet-500" />} label="New contacts created" value={result.created} />
              <ResultRow label="Total people processed" value={result.peopleCount} muted />
            </div>

            {(petitionTags.length > 0 || eventTags.length > 0) && (
              <div className="rounded-md border border-border/50 divide-y divide-border/30">
                {petitionTags.map((p) => (
                  <ResultRow
                    key={`p-${p.label}`}
                    icon={<FileSignature className="h-4 w-4 text-purple-500" />}
                    label={`Signed: ${p.label}`}
                    value={p.tagged}
                  />
                ))}
                {eventTags.map((e) => (
                  <ResultRow
                    key={`e-${e.label}`}
                    icon={<CalendarCheck className="h-4 w-4 text-orange-500" />}
                    label={`Attended: ${e.label}`}
                    value={e.tagged}
                  />
                ))}
              </div>
            )}

            {result.capped && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Some records were capped to keep the sync within time limits. Run the sync again to pull the rest.</span>
              </div>
            )}

            {pushResult ? (
              <div className="rounded-md border border-border/50 divide-y divide-border/30">
                <ResultRow icon={<ArrowUpFromLine className="h-4 w-4 text-green-500" />} label="Pushed to Action Network" value={pushResult.pushed} />
                {pushResult.pushFailed > 0 && (
                  <ResultRow label="Failed to push" value={pushResult.pushFailed} danger />
                )}
              </div>
            ) : result.pendingPush.length > 0 ? (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs">
                  {result.pendingPush.length} CRM contact{result.pendingPush.length !== 1 ? 's' : ''} tagged
                  &ldquo;Action Network&rdquo; {result.pendingPush.length !== 1 ? 'are' : 'is'} not
                  yet in Action Network:
                </p>
                <div className="max-h-40 overflow-y-auto rounded-md border border-border/50 bg-muted/30 p-2 space-y-0.5 text-xs">
                  {result.pendingPush.map((c) => (
                    <div key={c.id} className="flex justify-between gap-2">
                      <span className="truncate">{c.name || '(no name)'}</span>
                      <span className="text-muted-foreground truncate shrink-0">{c.email}</span>
                    </div>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={confirmPush}
                  disabled={pending}
                >
                  {pending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Pushing…</>
                  ) : (
                    <><ArrowUpFromLine className="h-4 w-4 mr-2" /> Push {result.pendingPush.length} to Action Network</>
                  )}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">All tagged contacts are already in Action Network.</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            This will fetch your Action Network people so you can choose which
            ones to sync. Matched contacts get tagged, and unmatched people
            become new CRM contacts. Petition/event participation is tagged too.
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Close
          </Button>
          {configured && state === 'idle' && (
            <Button onClick={runPreview} disabled={pending}>
              {pending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" /> Preview contacts</>
              )}
            </Button>
          )}
          {configured && state === 'preview' && (
            <Button onClick={runSync} disabled={pending || selectedEmails.size === 0}>
              {pending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Syncing…</>
              ) : (
                <><ArrowDownToLine className="h-4 w-4 mr-2" /> Sync {selectedEmails.size} contact{selectedEmails.size !== 1 ? 's' : ''}</>
              )}
            </Button>
          )}
          {configured && state === 'synced' && (
            <Button onClick={runPreview} disabled={pending}>
              {pending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" /> Sync again</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultRow({
  icon, label, value, muted, danger,
}: {
  icon?: React.ReactNode;
  label: string;
  value: number;
  muted?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className={`flex items-center gap-2 min-w-0 ${muted ? 'text-muted-foreground' : ''} ${danger ? 'text-destructive' : ''}`}>
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className="font-medium tabular-nums shrink-0">{value}</span>
    </div>
  );
}
