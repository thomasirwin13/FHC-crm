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
import { RefreshCw, Loader2, ArrowDownToLine, ArrowUpFromLine, Check } from 'lucide-react';
import { syncMailerLiteAction, MailerLiteSyncResult } from './mailerlite-sync-action';
import { toast } from 'sonner';

interface Props {
  configured: boolean;
}

export default function MailerLiteSyncDialog({ configured }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<MailerLiteSyncResult | null>(null);

  const runSync = () => {
    setResult(null);
    startTransition(async () => {
      const res = await syncMailerLiteAction();
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      setResult(res.result);
      toast.success('MailerLite sync complete');
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        className="flex-shrink-0"
        onClick={() => setOpen(true)}
      >
        <RefreshCw className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">MailerLite</span>
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sync with MailerLite</DialogTitle>
          <DialogDescription>
            Pulls subscribers from MailerLite and tags matching contacts as
            &ldquo;Newsletter subscriber&rdquo;, and pushes CRM newsletter
            contacts back to MailerLite.
          </DialogDescription>
        </DialogHeader>

        {!configured ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
            MailerLite isn&rsquo;t connected yet. Add <code className="text-xs">MAILERLITE_API_KEY</code> to
            the environment (and optionally <code className="text-xs">MAILERLITE_GROUP_ID</code> to scope to
            one group), then redeploy.
          </div>
        ) : result ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-emerald-500">
              <Check className="h-4 w-4" /> Sync complete
            </div>
            <div className="rounded-md border border-border/50 divide-y divide-border/30">
              <ResultRow icon={<ArrowDownToLine className="h-4 w-4 text-blue-500" />} label="Newly tagged from MailerLite" value={result.pulled} />
              <ResultRow label="Already tagged" value={result.alreadyTagged} muted />
              <ResultRow label="Subscribers with no CRM match" value={result.unmatched} muted />
              <ResultRow icon={<ArrowUpFromLine className="h-4 w-4 text-green-500" />} label="Pushed to MailerLite" value={result.pushed} />
              {result.pushFailed > 0 && (
                <ResultRow label="Failed to push" value={result.pushFailed} danger />
              )}
              <ResultRow label="Total MailerLite subscribers" value={result.subscriberCount} muted />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            This matches contacts by email address. It won&rsquo;t create new CRM
            contacts &mdash; only tags existing ones and adds tagged contacts to
            MailerLite.
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
      <span className={`flex items-center gap-2 ${muted ? 'text-muted-foreground' : ''} ${danger ? 'text-destructive' : ''}`}>
        {icon}
        {label}
      </span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
