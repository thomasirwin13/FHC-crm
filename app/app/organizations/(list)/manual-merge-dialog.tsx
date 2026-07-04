'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { mergeOrganizationsAction } from '@/app/app/organizations/merge-actions';

interface Org {
  id: number;
  name: string;
  location?: string | null;
  website?: string | null;
  type?: string | null;
  status?: string | null;
}

interface ManualMergeOrgsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizations: Org[];
  onMerged: (survivorId: number, removedIds: number[]) => void;
}

export default function ManualMergeOrgsDialog({
  open,
  onOpenChange,
  organizations,
  onMerged,
}: ManualMergeOrgsDialogProps) {
  const [primaryId, setPrimaryId] = useState(organizations[0]?.id);
  const [merging, setMerging] = useState(false);

  const duplicateIds = organizations.filter((o) => o.id !== primaryId).map((o) => o.id);

  const handleMerge = async () => {
    setMerging(true);
    const result = await mergeOrganizationsAction(primaryId, duplicateIds);
    if ('error' in result && result.error) {
      toast.error(result.error);
      setMerging(false);
    } else {
      toast.success(result.success || 'Organizations merged');
      onMerged(primaryId, duplicateIds);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge {organizations.length} organizations</DialogTitle>
          <DialogDescription>
            Select which organization to keep — the others will be merged into it and all contacts transferred.
          </DialogDescription>
        </DialogHeader>
        <div className="divide-y divide-border/50 border border-border/50 rounded-lg overflow-hidden">
          {organizations.map((org) => (
            <label
              key={org.id}
              className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/20 transition-colors"
            >
              <input
                type="radio"
                name="primary-manual-org"
                value={org.id}
                checked={primaryId === org.id}
                onChange={() => setPrimaryId(org.id)}
                className="mt-0.5 flex-shrink-0"
              />
              <div className="flex-1 min-w-0 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{org.name}</span>
                  {primaryId === org.id && (
                    <Badge className="text-xs h-4 px-1.5">keep</Badge>
                  )}
                </div>
                <div className="text-muted-foreground text-xs mt-0.5 space-x-3">
                  {org.type && <span>{org.type}</span>}
                  {org.location && <span>{org.location}</span>}
                  {org.status && <span>· {org.status}</span>}
                </div>
              </div>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 pt-2">
          <p className="text-xs text-muted-foreground">
            The kept organization will inherit all contacts from the others.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={merging}>
              Cancel
            </Button>
            <Button onClick={handleMerge} disabled={merging}>
              {merging ? 'Merging…' : 'Merge'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
