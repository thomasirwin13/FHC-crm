'use client';

import { useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  RefreshCw, Loader2, ArrowDownToLine, ArrowUpFromLine, Check, Plus, FileSignature, CalendarCheck, AlertTriangle,
} from 'lucide-react';
import {
  syncActionNetworkAction,
  pushToActionNetworkAction,
  ActionNetworkSyncResult,
  ActionNetworkPushResult,
} from './action-network-sync-action';
import { toast } from 'sonner';

interface Props {
  configured: boolean;
}

export default function ActionNetworkSyncDialog({ configured }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionNetworkSyncResult | null>(null);
  const [pushResult, setPushResult] = useState<ActionNetworkPushResult | null>(null);

  const runSync = () => {
    setResult(null);
    setPushResult(null);
    startTransition(async () => {
      const res = await syncActionNetworkAction();
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      setResult(res.result);
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

  const petitionTags = result?.petitions.filter((p) => p.tagged > 0) ?? [];
  const eventTags = result?.events.filter((e) => e.tagged > 0) ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        className="flex-shrink-0"
        onClick={() => setOpen(true)}
      >
        <RefreshCw className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">Action Network</span>
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sync with Action Network</DialogTitle>
          <DialogDescription>
            Pulls activists from Action Network, tags matching contacts as
            &ldquo;Action Network&rdquo;, creates new contacts for unmatched
            people, and tags petition signers and event attendees.
          </DialogDescription>
        </DialogHeader>

        {!configured ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
            Action Network isn&rsquo;t connected yet. Add your team&rsquo;s API key in{' '}
            <a href="/settings/integrations" className="underline font-medium">Settings &rarr; Integrations</a>.
            Find the key in Action Network under Start Organizing &rarr; Details &rarr; API &amp; Sync.
          </div>
        ) : result ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-emerald-500">
              <Check className="h-4 w-4" /> Sync complete
            </div>
            <div className="rounded-md border border-border/50 divide-y divide-border/30">
              <ResultRow icon={<ArrowDownToLine className="h-4 w-4 text-blue-500" />} label="Newly tagged from Action Network" value={result.pulled} />
              <ResultRow label="Already tagged" value={result.alreadyTagged} muted />
              <ResultRow icon={<Plus className="h-4 w-4 text-violet-500" />} label="New contacts created" value={result.created} />
              <ResultRow label="Total Action Network people" value={result.peopleCount} muted />
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

            {/* Push section */}
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
            This matches contacts by email address. Unmatched Action Network
            people will be added as new CRM contacts, and petition/event
            participation becomes a category tag.
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Close
          </Button>
          {configured && (
            <Button onClick={runSync} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Syncing…
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" /> {result ? 'Sync again' : 'Start sync'}
                </>
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
