'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface MeetingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; date: string; location?: string; notes?: string }) => Promise<void>;
  defaultValues?: { name: string; date: string; location?: string; notes?: string };
  title?: string;
}

export default function MeetingFormDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  title = 'New meeting',
}: MeetingFormDialogProps) {
  const [name, setName] = useState(defaultValues?.name || '');
  const [date, setDate] = useState(defaultValues?.date || '');
  const [location, setLocation] = useState(defaultValues?.location || '');
  const [notes, setNotes] = useState(defaultValues?.notes || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({ name, date, location: location || undefined, notes: notes || undefined });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Meeting name</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Monthly gathering" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location">Location <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="location" value={location} onChange={e => setLocation(e.target.value)} placeholder="Church hall, etc." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes about this meeting..." rows={3} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
