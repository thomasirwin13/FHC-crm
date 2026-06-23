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
import { Calendar, MapPin, X, Plus } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { toast } from 'sonner';
import { addMeetingAttendanceAction, removeMeetingAttendanceAction } from './meeting-attendance-actions';

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
  const [showAdd, setShowAdd] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState('');
  const [adding, setAdding] = useState(false);

  const attendedIds = new Set(history.map((h) => h.meeting_id));
  const available = allMeetings.filter((m) => !attendedIds.has(m.id));

  const handleAdd = async () => {
    if (!selectedMeetingId) return;
    const meetingId = parseInt(selectedMeetingId);
    const meeting = allMeetings.find((m) => m.id === meetingId);
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
      setSelectedMeetingId('');
      setShowAdd(false);
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
          {!showAdd && available.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add to meeting
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {showAdd && (
          <div className="flex gap-2 pb-2">
            <Select value={selectedMeetingId} onValueChange={setSelectedMeetingId}>
              <SelectTrigger className="flex-1 h-9">
                <SelectValue placeholder="Select a meeting…" />
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
            <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setSelectedMeetingId(''); }}>
              Cancel
            </Button>
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
