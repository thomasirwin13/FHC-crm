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
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteAllContactsAction } from './delete-all-contacts-action';

const CONFIRMATION_TEXT = 'DELETE ALL';

interface DeleteAllContactsDialogProps {
  contactCount: number;
}

export default function DeleteAllContactsDialog({ contactCount }: DeleteAllContactsDialogProps) {
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
      window.location.reload();
    });
  };

  const handleClose = () => {
    if (pending) return;
    setOpen(false);
    setConfirmation('');
  };

  if (contactCount === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (v) setOpen(true); else handleClose(); }}>
      <Button
        variant="outline"
        size="sm"
        className="flex-shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50 transition-all duration-150"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">Delete all</span>
      </Button>
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
  );
}
