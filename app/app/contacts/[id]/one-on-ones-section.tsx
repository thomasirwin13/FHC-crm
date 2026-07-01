'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { createOneOnOneAction, deleteOneOnOneAction } from './one-on-one-actions';
import { toast } from 'sonner';
import { OneOnOne } from '@/lib/db/supabase-queries';

type TeamMember = { id: number; name: string | null; email: string };

interface OneOnOnesSectionProps {
  contactId: number;
  initialOneOnOnes: OneOnOne[];
  teamMembers: TeamMember[];
  currentUserId?: number;
}

export default function OneOnOnesSection({ contactId, initialOneOnOnes, teamMembers, currentUserId }: OneOnOnesSectionProps) {
  const [records, setRecords] = useState(initialOneOnOnes);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [userId, setUserId] = useState<string>(currentUserId ? String(currentUserId) : 'manual');
  const [organizerName, setOrganizerName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await createOneOnOneAction({
      contact_id: contactId,
      date,
      notes: notes || undefined,
      user_id: userId !== 'manual' ? parseInt(userId) : null,
      organizer_name: userId === 'manual' ? organizerName || undefined : undefined,
    });
    setLoading(false);
    if ('error' in result && result.error) {
      toast.error(result.error);
    } else if (result.data) {
      setRecords(prev => [result.data as OneOnOne, ...prev]);
      toast.success('1-on-1 logged');
      setDialogOpen(false);
      setDate(''); setNotes(''); setUserId(currentUserId ? String(currentUserId) : 'manual'); setOrganizerName('');
    }
  };

  const handleDelete = async (id: number) => {
    const result = await deleteOneOnOneAction(id, contactId);
    if ('error' in result && result.error) {
      toast.error(result.error);
    } else {
      setRecords(prev => prev.filter(r => r.id !== id));
      toast.success('1-on-1 deleted');
    }
  };

  const getOrganizerLabel = (record: OneOnOne) => {
    if (record.organizer && 'name' in record.organizer && record.organizer.name) return record.organizer.name as string;
    if (record.organizer_name) return record.organizer_name;
    return 'Unknown organizer';
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">1-on-1 meetings</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Log 1-on-1
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No 1-on-1s logged yet.</p>
        ) : (
          <div className="space-y-3">
            {records.map(record => (
              <div key={record.id} className="flex items-start justify-between gap-3 p-3 rounded-md border border-border/50 bg-muted/30">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(record.date), 'MMM d, yyyy')}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {getOrganizerLabel(record)}
                    </span>
                  </div>
                  {record.notes && <p className="text-sm">{record.notes}</p>}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={() => handleDelete(record.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log 1-on-1 meeting</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Organizer</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organizer" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map(m => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name || m.email}</SelectItem>
                  ))}
                  <SelectItem value="manual">Other (enter name)</SelectItem>
                </SelectContent>
              </Select>
              {userId === 'manual' && (
                <Input
                  className="mt-2"
                  placeholder="Organizer name"
                  value={organizerName}
                  onChange={e => setOrganizerName(e.target.value)}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="What was discussed..." rows={3} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={loading}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
