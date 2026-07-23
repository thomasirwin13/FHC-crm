'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Pencil, Calendar, User, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { createOneOnOneAction, updateOneOnOneAction, deleteOneOnOneAction } from './one-on-one-actions';
import { toast } from 'sonner';
import { OneOnOne } from '@/lib/db/supabase-queries';
import { RichTextEditor, RichTextDisplay } from '@/components/ui/rich-text-editor';

type TeamMember = { id: number; name: string | null; email: string };

export const MEETING_FORM_OPTIONS = [
  { value: 'not_specified', label: 'Not specified' },
  { value: 'text_check_in', label: 'Text check-in' },
  { value: 'phone_call', label: 'Phone call' },
  { value: 'zoom_meeting', label: 'Zoom meeting' },
  { value: 'in_person', label: 'In-person meeting' },
] as const;

export const MEETING_FORM_LABELS: Record<string, string> = Object.fromEntries(
  MEETING_FORM_OPTIONS.map((o) => [o.value, o.label])
);

const NOTES_TEMPLATE = `<h2>Position in the org/group:</h2>
<p></p>
<h2>Where do they find themselves within the 4 Faces?</h2>
<p></p>
<h2>The 2-3 most meaningful things they shared:</h2>
<ul><li></li></ul>
<h2>Additional stories to remember or possibly share with others:</h2>
<ul><li></li></ul>
<h2>Plan to follow up with this person:</h2>
<ul><li></li></ul>`;

interface OneOnOnesSectionProps {
  contactId: number;
  initialOneOnOnes: OneOnOne[];
  teamMembers: TeamMember[];
  currentUserId?: number;
}

export default function OneOnOnesSection({ contactId, initialOneOnOnes, teamMembers, currentUserId }: OneOnOnesSectionProps) {
  const [records, setRecords] = useState(initialOneOnOnes);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OneOnOne | null>(null);
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [userId, setUserId] = useState<string>(currentUserId ? String(currentUserId) : 'manual');
  const [organizerName, setOrganizerName] = useState('');
  const [meetingForm, setMeetingForm] = useState<string>('not_specified');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setDate('');
    setNotes('');
    setUserId(currentUserId ? String(currentUserId) : 'manual');
    setOrganizerName('');
    setMeetingForm('not_specified');
    setEditingRecord(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (record: OneOnOne) => {
    setEditingRecord(record);
    setDate(record.date);
    setNotes(record.notes || '');
    setUserId(record.user_id ? String(record.user_id) : 'manual');
    setOrganizerName(record.organizer_name || '');
    setMeetingForm((record as any).meeting_form || 'not_specified');
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (editingRecord) {
      const result = await updateOneOnOneAction(editingRecord.id, contactId, {
        contact_id: contactId,
        date,
        notes: notes || undefined,
        user_id: userId !== 'manual' ? parseInt(userId) : null,
        organizer_name: userId === 'manual' ? organizerName || undefined : undefined,
        meeting_form: meetingForm,
      });
      setLoading(false);
      if ('error' in result && result.error) {
        toast.error(result.error);
      } else {
        setRecords(prev => prev.map(r => r.id === editingRecord.id ? {
          ...r,
          date,
          notes: notes || null,
          user_id: userId !== 'manual' ? parseInt(userId) : null,
          organizer_name: userId === 'manual' ? organizerName || null : null,
          ...(meetingForm ? { meeting_form: meetingForm } : {}),
        } as any : r));
        toast.success('1-on-1 updated');
        setDialogOpen(false);
        resetForm();
      }
    } else {
      const result = await createOneOnOneAction({
        contact_id: contactId,
        date,
        notes: notes || undefined,
        user_id: userId !== 'manual' ? parseInt(userId) : null,
        organizer_name: userId === 'manual' ? organizerName || undefined : undefined,
        meeting_form: meetingForm,
      });
      setLoading(false);
      if ('error' in result && result.error) {
        toast.error(result.error);
      } else if (result.data) {
        setRecords(prev => [result.data as OneOnOne, ...prev]);
        toast.success('1-on-1 logged');
        setDialogOpen(false);
        resetForm();
      }
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
          <Button size="sm" variant="outline" onClick={openCreateDialog}>
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
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(record.date + 'T00:00:00'), 'MMM d, yyyy')}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {getOrganizerLabel(record)}
                    </span>
                    {(record as any).meeting_form && (record as any).meeting_form !== 'not_specified' && (
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {MEETING_FORM_LABELS[(record as any).meeting_form] || (record as any).meeting_form}
                      </span>
                    )}
                  </div>
                  {record.notes && (
                    <RichTextDisplay html={record.notes} className="mt-1 text-sm" />
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
                    onClick={() => openEditDialog(record)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                    onClick={() => handleDelete(record.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRecord ? 'Edit 1-on-1 meeting' : 'Log 1-on-1 meeting'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Meeting form</Label>
              <Select value={meetingForm} onValueChange={setMeetingForm}>
                <SelectTrigger>
                  <SelectValue placeholder="Select form" />
                </SelectTrigger>
                <SelectContent>
                  {MEETING_FORM_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <div className="flex items-center justify-between">
                <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setNotes(prev => (prev.trim() && prev !== '<p></p>' ? prev + NOTES_TEMPLATE : NOTES_TEMPLATE))}
                >
                  Use template
                </Button>
              </div>
              <RichTextEditor
                value={notes}
                onChange={setNotes}
                placeholder="What was discussed..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} disabled={loading}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Saving...' : (editingRecord ? 'Update' : 'Save')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
