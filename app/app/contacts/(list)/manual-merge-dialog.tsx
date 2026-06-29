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
import { mergeContactsAction } from '@/app/app/contacts/merge-actions';
import { ContactWithOrganization } from '@/lib/db/supabase-queries';

interface ManualMergeContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: ContactWithOrganization[];
  onMerged: (survivorId: number, removedIds: number[]) => void;
}

export default function ManualMergeContactsDialog({
  open,
  onOpenChange,
  contacts,
  onMerged,
}: ManualMergeContactsDialogProps) {
  const [primaryId, setPrimaryId] = useState(contacts[0]?.id);
  const [merging, setMerging] = useState(false);

  const duplicateIds = contacts.filter((c) => c.id !== primaryId).map((c) => c.id);

  const handleMerge = async () => {
    setMerging(true);
    const result = await mergeContactsAction(primaryId, duplicateIds);
    if ('error' in result && result.error) {
      toast.error(result.error);
      setMerging(false);
    } else {
      toast.success(result.success || 'Contacts merged');
      onMerged(primaryId, duplicateIds);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge {contacts.length} contacts</DialogTitle>
          <DialogDescription>
            Select which contact to keep — the others will be merged into it and their data transferred.
          </DialogDescription>
        </DialogHeader>
        <div className="divide-y divide-border/50 border border-border/50 rounded-lg overflow-hidden">
          {contacts.map((contact) => (
            <label
              key={contact.id}
              className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/20 transition-colors"
            >
              <input
                type="radio"
                name="primary-manual-contact"
                value={contact.id}
                checked={primaryId === contact.id}
                onChange={() => setPrimaryId(contact.id)}
                className="mt-0.5 flex-shrink-0"
              />
              <div className="flex-1 min-w-0 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{contact.name}</span>
                  {primaryId === contact.id && (
                    <Badge className="text-xs h-4 px-1.5">keep</Badge>
                  )}
                </div>
                <div className="text-muted-foreground text-xs mt-0.5 space-x-3">
                  {contact.email && <span>{contact.email}</span>}
                  {contact.phone && <span>{contact.phone}</span>}
                  {(contact as any).organization?.name && <span>· {(contact as any).organization.name}</span>}
                </div>
              </div>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 pt-2">
          <p className="text-xs text-muted-foreground">
            The kept contact will inherit all data from the others.
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
