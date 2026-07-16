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
import { Input } from '@/components/ui/input';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { deleteAllContactsAction } from '@/app/app/contacts/(list)/delete-all-contacts-action';

const CONFIRMATION_TEXT = 'DELETE ALL';

interface DangerZoneProps {
  contactCount: number;
}

export default function DangerZone({ contactCount }: DangerZoneProps) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [pending, startTransition] = useTransition();

  const confirmed = confirmation === CONFIRMATION_TEXT;

  const handleDelete = () => {
    if (!confirmed) return;
    startTransition(async () => {
      const res = await deleteAllContactsAction();
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Deleted ${res.deleted} contact${res.deleted !== 1 ? 's' : ''}`);
      setOpen(false);
      setConfirmation('');
    });
  };

  const handleClose = () => {
    if (pending) return;
    setOpen(false);
    setConfirmation('');
  };

  return (
    <div className="bg-card border border-destructive/30 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <h2 className="text-xl font-semibold text-foreground">Danger zone</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Irreversible actions that affect all data on your team.
      </p>

      <div className="flex items-center justify-between gap-4 p-4 border border-destructive/20 rounded-md">
        <div>
          <p className="text-sm font-medium text-foreground">Delete all contacts</p>
          <p className="text-xs text-muted-foreground">
            {contactCount === 0
              ? 'No contacts to delete.'
              : `Permanently delete all ${contactCount} contact${contactCount !== 1 ? 's' : ''} from your team.`}
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          disabled={contactCount === 0}
          onClick={() => setOpen(true)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete all contacts
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (v) setOpen(true); else handleClose(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete all contacts</DialogTitle>
            <DialogDescription>
              This will permanently delete all {contactCount} contact{contactCount !== 1 ? 's' : ''} from
              your team. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-foreground">
              Type <span className="font-mono font-semibold text-destructive">{CONFIRMATION_TEXT}</span> to confirm:
            </p>
            <Input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={CONFIRMATION_TEXT}
              disabled={pending}
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={handleClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={pending || !confirmed}
            >
              {pending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting...</>
              ) : (
                <>Delete all {contactCount} contacts</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
