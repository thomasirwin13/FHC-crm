'use client';

import { useState } from 'react';
import { MeetingWithAttendance } from '@/lib/db/supabase-queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Calendar, MapPin, Users, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { createMeetingAction, deleteMeetingAction } from './actions';
import MeetingFormDialog from './meeting-form-dialog';
import Link from 'next/link';
import { toast } from 'sonner';

interface MeetingsListProps {
  initialMeetings: MeetingWithAttendance[];
}

export default function MeetingsList({ initialMeetings }: MeetingsListProps) {
  const [meetings, setMeetings] = useState(initialMeetings);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleCreate = async (data: { name: string; date: string; location?: string; notes?: string }) => {
    const result = await createMeetingAction(data);
    if ('error' in result && result.error) {
      toast.error(result.error);
    } else if (result.data) {
      setMeetings(prev => [{ ...result.data!, attendance: [] }, ...prev]);
      toast.success('Meeting created');
      setDialogOpen(false);
    }
  };

  const handleDelete = async (id: number) => {
    const result = await deleteMeetingAction(id);
    if ('error' in result && result.error) {
      toast.error(result.error);
    } else {
      setMeetings(prev => prev.filter(m => m.id !== id));
      toast.success('Meeting deleted');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New meeting
        </Button>
      </div>

      <MeetingFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreate}
      />

      {meetings.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No meetings yet. Create your first one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map(meeting => (
            <Card key={meeting.id} className="border-border/50 hover:border-border transition-colors">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <Link href={`/app/meetings/${meeting.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-medium">{meeting.name}</span>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(meeting.date), 'MMM d, yyyy')}
                      </span>
                      {meeting.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {meeting.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {meeting.attendance.length} attended
                      </span>
                    </div>
                  </div>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={() => handleDelete(meeting.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
