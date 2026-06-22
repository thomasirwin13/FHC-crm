'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Users, Check, Search } from 'lucide-react';
import { format } from 'date-fns';
import { setAttendanceAction } from '../actions';
import { toast } from 'sonner';
import Link from 'next/link';
import { Input } from '@/components/ui/input';

type Meeting = {
  id: number;
  name: string;
  date: string;
  location: string | null;
  notes: string | null;
  attendance: { id: number; contact_id: number; contact: { id: number; name: string; email: string | null } | null }[];
};

type Contact = { id: number; name: string; email: string | null };

interface MeetingDetailProps {
  meeting: Meeting;
  allContacts: Contact[];
}

export default function MeetingDetail({ meeting, allContacts }: MeetingDetailProps) {
  const [attended, setAttended] = useState<Set<number>>(
    new Set(meeting.attendance.map(a => a.contact_id))
  );
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const filtered = allContacts.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (contactId: number) => {
    setAttended(prev => {
      const next = new Set(prev);
      next.has(contactId) ? next.delete(contactId) : next.add(contactId);
      return next;
    });
    setDirty(true);
  };

  const saveAttendance = async () => {
    setSaving(true);
    const result = await setAttendanceAction(meeting.id, Array.from(attended));
    setSaving(false);
    if ('error' in result && result.error) {
      toast.error(result.error);
    } else {
      toast.success('Attendance saved');
      setDirty(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{meeting.name}</h1>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {format(new Date(meeting.date), 'MMMM d, yyyy')}
          </span>
          {meeting.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {meeting.location}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {attended.size} attended
          </span>
        </div>
        {meeting.notes && (
          <p className="text-sm text-muted-foreground pt-1">{meeting.notes}</p>
        )}
      </div>

      {/* Attendance */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Attendance</CardTitle>
            {dirty && (
              <Button size="sm" onClick={saveAttendance} disabled={saving}>
                {saving ? 'Saving...' : 'Save attendance'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search contacts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="divide-y divide-border max-h-[480px] overflow-y-auto rounded-md border border-border">
            {filtered.map(contact => {
              const isAttended = attended.has(contact.id);
              return (
                <div
                  key={contact.id}
                  className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${isAttended ? 'bg-primary/5' : ''}`}
                  onClick={() => toggle(contact.id)}
                >
                  <div>
                    <Link
                      href={`/app/contacts/${contact.id}`}
                      className="text-sm font-medium hover:underline"
                      onClick={e => e.stopPropagation()}
                    >
                      {contact.name}
                    </Link>
                    {contact.email && <p className="text-xs text-muted-foreground">{contact.email}</p>}
                  </div>
                  <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isAttended ? 'bg-primary border-primary' : 'border-border'}`}>
                    {isAttended && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">No contacts found</div>
            )}
          </div>
          {dirty && (
            <div className="flex justify-end">
              <Button size="sm" onClick={saveAttendance} disabled={saving}>
                {saving ? 'Saving...' : 'Save attendance'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
