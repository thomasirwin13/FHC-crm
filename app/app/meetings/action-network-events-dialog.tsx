'use client';

import { useState, useMemo, useTransition } from 'react';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw,
  Loader2,
  Check,
  Users,
  UserPlus,
  CalendarDays,
  ChevronLeft,
  Search,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { MeetingWithAttendance } from '@/lib/db/supabase-queries';
import { ContactMatchPicker } from '@/components/ui/contact-match-picker';
import {
  listActionNetworkEventsAction,
  getActionNetworkEventAttendeesAction,
  importActionNetworkEventAction,
  type ANEventSummary,
  type ANAttendee,
  type ANEventImportResult,
} from './action-network-events-action';

interface ExistingContact {
  id: number;
  name: string;
  email?: string | null;
}

interface Props {
  configured: boolean;
  existingContacts: ExistingContact[];
  meetings: MeetingWithAttendance[];
}

type Step = 'events' | 'attendees' | 'result';

export default function ActionNetworkEventsDialog({ configured, existingContacts, meetings }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>('events');

  const [events, setEvents] = useState<ANEventSummary[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [eventSearch, setEventSearch] = useState('');

  const [selectedEvent, setSelectedEvent] = useState<ANEventSummary | null>(null);
  const [attendees, setAttendees] = useState<ANAttendee[]>([]);
  const [capped, setCapped] = useState(false);

  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);
  const [meetingName, setMeetingName] = useState('');
  const [meetingDate, setMeetingDate] = useState('');

  const [manualMatches, setManualMatches] = useState<Record<string, { id: number; name: string }>>({});
  const [matchPickerAnId, setMatchPickerAnId] = useState<string | null>(null);

  const [result, setResult] = useState<ANEventImportResult | null>(null);

  const reset = () => {
    setStep('events');
    setSelectedEvent(null);
    setAttendees([]);
    setCapped(false);
    setSelectedMeetingId(null);
    setMeetingName('');
    setMeetingDate('');
    setManualMatches({});
    setMatchPickerAnId(null);
    setResult(null);
  };

  const loadEvents = () => {
    startTransition(async () => {
      const res = await listActionNetworkEventsAction();
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      setEvents(res.result.events);
      setEventsLoaded(true);
    });
  };

  const openDialog = () => {
    setOpen(true);
    if (!eventsLoaded) loadEvents();
  };

  const selectEvent = (ev: ANEventSummary) => {
    setSelectedEvent(ev);
    setMeetingName(ev.title);
    setMeetingDate(ev.date || '');
    setSelectedMeetingId(null);
    setManualMatches({});
    setMatchPickerAnId(null);
    startTransition(async () => {
      const res = await getActionNetworkEventAttendeesAction(ev.id);
      if ('error' in res) {
        toast.error(res.error);
        setSelectedEvent(null);
        return;
      }
      setAttendees(res.result.attendees);
      setCapped(res.result.capped);
      setStep('attendees');
    });
  };

  const selectExistingMeeting = (m: MeetingWithAttendance) => {
    setSelectedMeetingId(m.id);
    setMeetingName(m.name);
    setMeetingDate(m.date);
  };

  const handleImport = () => {
    if (!attendees.length || !meetingName.trim() || !meetingDate) return;
    startTransition(async () => {
      const matchMap = Object.keys(manualMatches).length > 0
        ? Object.fromEntries(Object.entries(manualMatches).map(([anId, c]) => [anId, c.id]))
        : undefined;
      const res = await importActionNetworkEventAction(
        selectedMeetingId,
        meetingName.trim(),
        meetingDate,
        attendees,
        matchMap,
      );
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      setResult(res.result);
      setStep('result');
      toast.success(`Imported attendance for "${res.result.meetingName}"`);
    });
  };

  const filteredEvents = useMemo(() => {
    const q = eventSearch.toLowerCase().trim();
    if (!q) return events;
    return events.filter((e) => e.title.toLowerCase().includes(q));
  }, [events, eventSearch]);

  const matchedCount = attendees.filter(
    (a) => a.status === 'existing' || manualMatches[a.anId]
  ).length;
  const newCount = attendees.length - matchedCount;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <Button size="sm" variant="outline" onClick={openDialog}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Pull from Action Network
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 'attendees' && selectedEvent ? (
              <button
                type="button"
                className="flex items-center gap-1.5 text-left hover:text-primary transition-colors"
                onClick={() => { setStep('events'); setSelectedEvent(null); }}
              >
                <ChevronLeft className="h-4 w-4" /> {selectedEvent.title}
              </button>
            ) : (
              'Action Network attendance'
            )}
          </DialogTitle>
          <DialogDescription>
            {step === 'events'
              ? 'Select an event to see who participated and import attendance into the CRM.'
              : step === 'attendees'
              ? 'Review participants, then import them as meeting attendance. New people are added to the CRM.'
              : 'Import complete.'}
          </DialogDescription>
        </DialogHeader>

        {!configured ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
            Action Network isn&rsquo;t connected yet. Add your API key in{' '}
            <a href="/settings/integrations" className="underline font-medium">
              Settings &rarr; Integrations
            </a>.
          </div>
        ) : step === 'events' ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {pending && !eventsLoaded ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading events…
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto rounded-md border border-border/50 bg-muted/20 divide-y divide-border/30">
                {filteredEvents.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                    {eventsLoaded ? 'No events found in Action Network.' : 'Loading…'}
                  </div>
                ) : (
                  filteredEvents.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      disabled={pending}
                      onClick={() => selectEvent(ev)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors disabled:opacity-60"
                    >
                      <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{ev.title}</div>
                        {ev.date && (
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(ev.date + 'T00:00:00'), 'MMM d, yyyy')}
                          </div>
                        )}
                      </div>
                      {pending && selectedEvent?.id === ev.id && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        ) : step === 'attendees' ? (
          <div className="space-y-4">
            {/* Meeting target */}
            <div className="space-y-2">
              <Label>Import into meeting</Label>
              {meetings.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {meetings.slice(0, 6).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        selectedMeetingId === m.id
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border/50 text-muted-foreground hover:border-foreground/30'
                      }`}
                      onClick={() => selectExistingMeeting(m)}
                    >
                      {m.name}
                    </button>
                  ))}
                  {selectedMeetingId && (
                    <button
                      type="button"
                      className="text-xs px-2 py-0.5 rounded-full border border-border/50 text-muted-foreground hover:border-foreground/30"
                      onClick={() => {
                        setSelectedMeetingId(null);
                        setMeetingName(selectedEvent?.title || '');
                        setMeetingDate(selectedEvent?.date || '');
                      }}
                    >
                      + New meeting
                    </button>
                  )}
                </div>
              )}
              {!selectedMeetingId && (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Meeting name"
                    value={meetingName}
                    onChange={(e) => setMeetingName(e.target.value)}
                  />
                  <Input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Attendee summary */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {attendees.length} participant{attendees.length !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                {matchedCount > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/30 text-blue-500">{matchedCount} existing</Badge>}
                {newCount > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-violet-500/30 text-violet-500">{newCount} new</Badge>}
              </div>
            </div>

            {capped && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Some records were capped by Action Network limits — a few attendees may be missing.
              </p>
            )}

            {/* Attendee list */}
            <div className="max-h-64 overflow-y-auto rounded-md border border-border/50 bg-muted/20 divide-y divide-border/30">
              {attendees.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No participants found for this event.
                </div>
              ) : (
                attendees.map((a) => {
                  const manual = manualMatches[a.anId];
                  return (
                    <div key={a.anId}>
                      <div className="flex items-center gap-2 px-3 py-1.5">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{a.name || a.email || '(no name)'}</div>
                          {a.email && a.name && (
                            <div className="text-xs text-muted-foreground truncate">{a.email}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {manual ? (
                            <>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-purple-500/30 text-purple-500">
                                → {manual.name}
                              </Badge>
                              <button
                                onClick={() => setManualMatches((p) => { const n = { ...p }; delete n[a.anId]; return n; })}
                                className="text-[10px] text-muted-foreground hover:text-foreground"
                              >
                                ✕
                              </button>
                            </>
                          ) : a.status === 'existing' ? (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-blue-500/30 text-blue-500">
                              Existing
                            </Badge>
                          ) : (
                            <>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-violet-500/30 text-violet-500">
                                New
                              </Badge>
                              <button
                                onClick={() => setMatchPickerAnId(matchPickerAnId === a.anId ? null : a.anId)}
                                className="text-[10px] text-primary hover:underline whitespace-nowrap"
                              >
                                Match
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {matchPickerAnId === a.anId && (
                        <div className="px-3 pb-2">
                          <ContactMatchPicker
                            contacts={existingContacts}
                            onSelect={(c) => {
                              setManualMatches((p) => ({ ...p, [a.anId]: c }));
                              setMatchPickerAnId(null);
                            }}
                            onCancel={() => setMatchPickerAnId(null)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : result ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-emerald-500">
              <Check className="h-4 w-4" /> Import complete
            </div>
            <div className="rounded-md border border-border/50 divide-y divide-border/30">
              <ResultRow icon={<CalendarDays className="h-4 w-4 text-blue-500" />} label="Meeting" text={result.meetingName} />
              <ResultRow icon={<Users className="h-4 w-4 text-blue-500" />} label="Existing contacts matched" value={result.matched} />
              <ResultRow icon={<UserPlus className="h-4 w-4 text-violet-500" />} label="New contacts created" value={result.created} />
              {result.alreadyAttended > 0 && (
                <ResultRow label="Already marked attended" value={result.alreadyAttended} muted />
              )}
              <ResultRow label="Total participants" value={result.total} muted />
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => { setOpen(false); reset(); }} disabled={pending}>
            Close
          </Button>
          {step === 'events' && configured && (
            <Button variant="outline" onClick={loadEvents} disabled={pending}>
              {pending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…</> : <><RefreshCw className="h-4 w-4 mr-2" /> Refresh</>}
            </Button>
          )}
          {step === 'attendees' && (
            <Button
              onClick={handleImport}
              disabled={pending || attendees.length === 0 || !meetingName.trim() || !meetingDate}
            >
              {pending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing…</>
              ) : (
                <><Download className="h-4 w-4 mr-2" /> Import {attendees.length} attendee{attendees.length !== 1 ? 's' : ''}</>
              )}
            </Button>
          )}
          {step === 'result' && (
            <Button onClick={() => { setStep('events'); setSelectedEvent(null); setResult(null); }}>
              Import another
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultRow({
  icon, label, value, text, muted,
}: {
  icon?: React.ReactNode;
  label: string;
  value?: number;
  text?: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className={`flex items-center gap-2 ${muted ? 'text-muted-foreground' : ''}`}>
        {icon}
        {label}
      </span>
      <span className="font-medium tabular-nums">{text ?? value}</span>
    </div>
  );
}
