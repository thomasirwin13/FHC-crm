'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Calendar, MapPin, X, Plus } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { toast } from 'sonner';
import { addMeetingAttendanceAction, removeMeetingAttendanceAction } from './meeting-attendance-actions';
import { createMeetingAction } from '@/app/app/meetings/actions';

type Meeting = { id: number; name: string; date: string; location: string | null };

type HistoryItem = {
  id: number;
  meeting_id: number;
  meeting: Meeting | null;
};

interface MeetingHistorySectionProps {
  contactId: number;
  initialHistory: HistoryItem[];
  allMeetings: Meeting[];
}

export default function MeetingHistorySection({
  contactId,
  initialHistory,
  allMeetings,
}: MeetingHistorySectionProps) {
  const [history, setHistory] = useState<HistoryItem[]>(initialHistory.filter((h) => h.meeting));
  const [meetings, setMeetings] = useState<Meeting[]>(allMeetings);
  const [showAdd, setShowAdd] = useState(false);
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [selectedMeetingId, setSelectedMeetingId] = useState('');
  const [adding, setAdding] = useState(false);
  // New-meeting fields
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [creating, setCreating] = useState(false);

  const attendedIds = new Set(history.map((h) => h.meeting_id));
  const available = meetings.filter((m) => !attendedIds.has(m.id));

  const resetAdd = () => {
    setShowAdd(false);
    setMode('select');
    setSelectedMeetingId('');
    setNewName('');
    setNewDate('');
    setNewLocation('');
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newDate) return;
    setCreating(true);
    const result = await createMeetingAction({
      name: newName.trim(),
      date: newDate,
      location: newLocation.trim() || undefined,
    });
    if ('error' in result && result.error) {
      toast.error(result.error);
      setCreating(false);
      return;
    }
    const created = (result as any).data;
    const meeting: Meeting = {
      id: created.id,
      name: created.name,
      date: created.date,
      location: created.location ?? null,
    };
    // Add the meeting to the list and mark this contact as attending it.
    const attendResult = await addMeetingAttendanceAction(contactId, meeting.id);
    setCreating(false);
    if ('error' in attendResult && attendResult.error) {
      // Meeting was created but attendance failed — still surface the meeting.
      setMeetings((prev) => [meeting, ...prev]);
      toast.error(attendResult.error);
      return;
    }
    setMeetings((prev) => [meeting, ...prev]);
    setHistory((prev) => [{ id: Date.now(), meeting_id: meeting.id, meeting }, ...prev]);
    toast.success(`Created "${meeting.name}" and added attendance`);
    resetAdd();
  };

  const handleAdd = async () => {
    if (!selectedMeetingId) return;
    const meetingId = parseInt(selectedMeetingId);
    const meeting = meetings.find((m) => m.id === meetingId);
    if (!meeting) return;

    setAdding(true);
    const result = await addMeetingAttendanceAction(contactId, meetingId);
    if ('error' in result && result.error) {
      toast.error(result.error);
    } else {
      setHistory((prev) => [
        { id: Date.now(), meeting_id: meetingId, meeting },
        ...prev,
      ]);
      resetAdd();
      toast.success(`Added to ${meeting.name}`);
    }
    setAdding(false);
  };

  const handleRemove = async (item: HistoryItem) => {
    const result = await removeMeetingAttendanceAction(contactId, item.meeting_id);
    if ('error' in result && result.error) {
      toast.error(result.error);
    } else {
      setHistory((prev) => prev.filter((h) => h.meeting_id !== item.meeting_id));
      toast.success('Removed from meeting');
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Meeting attendance</CardTitle>
          {!showAdd && (
            <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add to meeting
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {showAdd && (
          <div className="pb-2 space-y-2">
            {/* Mode toggle */}
            <div className="flex gap-1 text-xs">
              <button
                onClick={() => setMode('select')}
                className={`px-2.5 py-1 rounded-md transition-colors ${mode === 'select' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted/50'}`}
              >
                Existing meeting
              </button>
              <button
                onClick={() => setMode('create')}
                className={`px-2.5 py-1 rounded-md transition-colors ${mode === 'create' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted/50'}`}
              >
                New meeting
              </button>
            </div>

            {mode === 'select' ? (
              <div className="flex gap-2">
                <Select value={selectedMeetingId} onValueChange={setSelectedMeetingId}>
                  <SelectTrigger className="flex-1 h-9">
                    <SelectValue placeholder={available.length ? 'Select a meeting…' : 'No more meetings — create one'} />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((m) => (
                      <SelectItem key={m.id} value={m.id.toString()}>
                        {m.name} — {format(new Date(m.date), 'MMM d, yyyy')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleAdd} disabled={!selectedMeetingId || adding}>
                  {adding ? 'Adding…' : 'Add'}
                </Button>
                <Button size="sm" variant="ghost" onClick={resetAdd}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="space-y-2 rounded-md border border-border/50 p-3">
                <Input
                  placeholder="Meeting name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Location (optional)"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="flex-1"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={resetAdd} disabled={creating}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || !newDate || creating}>
                    {creating ? 'Creating…' : 'Create & add'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {history.length === 0 && !showAdd ? (
          <p className="text-sm text-muted-foreground text-center py-6">No meetings attended yet.</p>
        ) : (
          <div className="space-y-1">
            {history.map((h) => (
              <div key={h.meeting_id} className="flex items-center gap-3 text-sm p-2 rounded-md hover:bg-muted/50 group">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <Link href={`/app/meetings/${h.meeting!.id}`} className="font-medium hover:underline">
                    {h.meeting!.name}
                  </Link>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>{format(new Date(h.meeting!.date), 'MMM d, yyyy')}</span>
                    {h.meeting!.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />{h.meeting!.location}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(h)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
                  title="Remove from meeting"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
