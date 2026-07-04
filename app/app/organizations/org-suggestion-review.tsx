'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { applyOrganizationSuggestionAction, type SuggestionItem, type OrgSuggestion } from './enrich-actions';

const FIELDS: { key: keyof OrgSuggestion; label: string }[] = [
  { key: 'website', label: 'Website' },
  { key: 'street', label: 'Street' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zip', label: 'ZIP' },
  { key: 'type', label: 'Type' },
  { key: 'regions', label: 'Region' },
  { key: 'description', label: 'Description' },
];

function hasValue(v: any): boolean {
  if (Array.isArray(v)) return v.length > 0;
  return v != null && String(v).trim() !== '';
}

function display(v: any): string {
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  return hasValue(v) ? String(v) : '—';
}

// Default: propose applying a suggestion only when it has a value and the
// current field is empty (never auto-check an overwrite of existing data).
function defaultSelection(item: SuggestionItem): Set<string> {
  const set = new Set<string>();
  for (const f of FIELDS) {
    if (hasValue(item.suggestion[f.key]) && !hasValue(item.current[f.key])) set.add(f.key as string);
  }
  return set;
}

export default function OrgSuggestionReview({
  items,
  open,
  onOpenChange,
}: {
  items: SuggestionItem[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<number, Set<string>>>(() => {
    const map: Record<number, Set<string>> = {};
    for (const it of items) map[it.id] = defaultSelection(it);
    return map;
  });
  const [applied, setApplied] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState<number | null>(null);

  const toggle = (orgId: number, key: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      const set = new Set(next[orgId] ?? []);
      set.has(key) ? set.delete(key) : set.add(key);
      next[orgId] = set;
      return next;
    });
  };

  const applyOne = async (item: SuggestionItem) => {
    const keys = Array.from(selected[item.id] ?? []);
    if (keys.length === 0) {
      toast.info('Nothing selected to apply.');
      return;
    }
    const patch: Record<string, any> = {};
    for (const k of keys) patch[k] = (item.suggestion as any)[k];
    setApplying(item.id);
    const result = await applyOrganizationSuggestionAction(item.id, patch);
    setApplying(null);
    if ('error' in result && result.error) {
      toast.error(result.error);
      return;
    }
    setApplied((prev) => new Set(prev).add(item.id));
    toast.success(`Updated ${item.name}`);
    router.refresh();
  };

  const pending = items.filter((it) => !applied.has(it.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Review suggested details
          </DialogTitle>
          <DialogDescription>
            AI-suggested from general knowledge — verify before applying. Only checked fields are saved; existing values are never overwritten unless you check them.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {items.map((item) => {
            const isApplied = applied.has(item.id);
            const rows = FIELDS.filter((f) => hasValue(item.suggestion[f.key]));
            return (
              <div key={item.id} className={`rounded-lg border p-3 ${isApplied ? 'border-green-500/30 bg-green-500/5 opacity-70' : 'border-border/50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{item.name}</span>
                  {isApplied ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-500"><Check className="h-3.5 w-3.5" /> Applied</span>
                  ) : (
                    <Button size="sm" onClick={() => applyOne(item)} disabled={applying === item.id}>
                      {applying === item.id ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Applying…</> : 'Apply selected'}
                    </Button>
                  )}
                </div>
                {rows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No confident suggestions for this organization.</p>
                ) : (
                  <div className="space-y-1.5">
                    {rows.map((f) => {
                      const checked = (selected[item.id] ?? new Set()).has(f.key as string);
                      const overwrite = hasValue(item.current[f.key]);
                      return (
                        <label key={f.key as string} className="flex items-start gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isApplied}
                            onChange={() => toggle(item.id, f.key as string)}
                            className="mt-0.5 h-3.5 w-3.5 flex-shrink-0"
                          />
                          <span className="w-16 flex-shrink-0 text-muted-foreground">{f.label}</span>
                          <span className="flex-1 min-w-0">
                            {overwrite && (
                              <span className="text-muted-foreground line-through mr-1.5">{display(item.current[f.key])}</span>
                            )}
                            <span className="text-foreground">{display(item.suggestion[f.key])}</span>
                            {overwrite && checked && <span className="ml-1 text-amber-500">(overwrites)</span>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {applied.size} applied · {pending.length} remaining
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
