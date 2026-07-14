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
import { Loader2, Sparkles, Check, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  scanAddressesAction,
  applyAddressCleanupAction,
  type AddressCleanupRow,
} from './cleanup-addresses-action';

export default function CleanupAddressesDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<AddressCleanupRow[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [applied, setApplied] = useState(false);

  const scan = () => {
    setRows(null);
    setApplied(false);
    startTransition(async () => {
      const res = await scanAddressesAction();
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      setRows(res.result.rows);
      setSelected(new Set(res.result.rows.map((r) => r.id)));
      if (res.result.rows.length === 0) {
        toast.info('All addresses look clean — nothing to fix');
      }
    });
  };

  const apply = () => {
    if (selected.size === 0) return;
    startTransition(async () => {
      const res = await applyAddressCleanupAction(Array.from(selected));
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      setApplied(true);
      toast.success(`Cleaned up ${res.updated} address${res.updated !== 1 ? 'es' : ''}`);
    });
  };

  const handleClose = () => {
    setOpen(false);
    setRows(null);
    setSelected(new Set());
    setApplied(false);
    if (applied) window.location.reload();
  };

  const toggleAll = () => {
    if (!rows) return;
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else { setOpen(true); scan(); } }}>
      <Button
        variant="outline"
        size="sm"
        className="flex-shrink-0 border-border hover:bg-accent hover:border-foreground/20 transition-all duration-150"
        onClick={() => { setOpen(true); scan(); }}
      >
        <Sparkles className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">Clean up</span>
      </Button>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Clean up addresses</DialogTitle>
          <DialogDescription>
            Finds addresses that contain city, state, or zip code mixed into the street field
            and splits them into the correct columns.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {pending && !rows && (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scanning addresses…
            </div>
          )}

          {rows && rows.length === 0 && (
            <div className="flex items-center justify-center py-12 text-sm">
              <Check className="h-4 w-4 mr-2 text-emerald-500" />
              All addresses look clean — nothing to fix.
            </div>
          )}

          {rows && rows.length > 0 && !applied && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {rows.length} address{rows.length !== 1 ? 'es' : ''} to clean up
                </span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={toggleAll}>
                  {selected.size === rows.length ? 'Deselect all' : 'Select all'}
                </Button>
              </div>
              <div className="border border-border rounded-lg overflow-auto max-h-96 divide-y divide-border">
                {rows.map((row) => (
                  <label
                    key={row.id}
                    className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                      !selected.has(row.id) ? 'opacity-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      className="rounded mt-1 shrink-0"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-medium text-sm truncate">{row.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {row.original}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <ArrowRight className="h-3 w-3 text-emerald-500 shrink-0" />
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          <span><span className="text-muted-foreground">Street:</span> {row.parsed.street}</span>
                          {row.parsed.city && (
                            <span>
                              <span className="text-muted-foreground">City:</span>{' '}
                              <span className={row.existingCity ? 'line-through text-muted-foreground' : 'text-emerald-600 dark:text-emerald-400'}>
                                {row.parsed.city}
                              </span>
                              {row.existingCity && (
                                <span className="text-xs text-muted-foreground ml-1">(already set)</span>
                              )}
                            </span>
                          )}
                          {row.parsed.state && (
                            <span>
                              <span className="text-muted-foreground">State:</span>{' '}
                              <span className={row.existingState ? 'line-through text-muted-foreground' : 'text-emerald-600 dark:text-emerald-400'}>
                                {row.parsed.state}
                              </span>
                              {row.existingState && (
                                <span className="text-xs text-muted-foreground ml-1">(already set)</span>
                              )}
                            </span>
                          )}
                          {row.parsed.zip && (
                            <span>
                              <span className="text-muted-foreground">Zip:</span>{' '}
                              <span className={row.existingZip ? 'line-through text-muted-foreground' : 'text-emerald-600 dark:text-emerald-400'}>
                                {row.parsed.zip}
                              </span>
                              {row.existingZip && (
                                <span className="text-xs text-muted-foreground ml-1">(already set)</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Fields marked &ldquo;already set&rdquo; won&rsquo;t be overwritten — only empty fields get filled in.
                The street field will always be trimmed to just the street portion.
              </p>
            </div>
          )}

          {applied && (
            <div className="flex items-center justify-center py-12 text-sm">
              <Check className="h-4 w-4 mr-2 text-emerald-500" />
              Addresses cleaned up successfully.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={pending}>
            {applied ? 'Done' : 'Cancel'}
          </Button>
          {rows && rows.length > 0 && !applied && (
            <Button onClick={apply} disabled={pending || selected.size === 0}>
              {pending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Applying…</>
              ) : (
                <>Clean up {selected.size} address{selected.size !== 1 ? 'es' : ''}</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
