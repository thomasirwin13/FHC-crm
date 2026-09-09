'use client';

import { useState, useRef, useTransition } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PartyPopper,
  Upload,
  Loader2,
  Check,
  UserPlus,
  Users,
  CalendarDays,
  TrendingUp,
} from 'lucide-react';
import Papa from 'papaparse';
import {
  importPartifulAction,
  PartifulGuest,
  PartifulImportResult,
} from './partiful-import-action';
import { toast } from 'sonner';
import { MeetingWithAttendance } from '@/lib/db/supabase-queries';
import { Badge } from '@/components/ui/badge';
import { ContactMatchPicker } from '@/components/ui/contact-match-picker';
import { findMatchingContact } from '@/lib/utils/name-matching';

const ENGAGEMENT_LEVELS = [
  { value: 'leader', label: 'Lead at aligned partner org (5)' },
  { value: 'leader_non_aligned', label: 'Leader of non-aligned (1a)' },
  { value: 'activist', label: 'Activist (4)' },
  { value: 'attender', label: 'Attender (3)' },
  { value: 'participator', label: 'Participator (2)' },
  { value: 'learner', label: 'Learner (1)' },
  { value: 'potential', label: 'Potential (0)' },
  { value: 'unlikely', label: 'Unlikely (A)' },
  { value: 'out_of_scope', label: 'Out of scope (B)' },
];

const NO_LEVEL = '__no_change__';

interface ExistingContact {
  id: number;
  name: string;
  email?: string | null;
}

interface Props {
  meetings: MeetingWithAttendance[];
  existingContacts: ExistingContact[];
}

export default function PartifulImportDialog({ meetings, existingContacts }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<PartifulImportResult | null>(null);
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);
  const [meetingName, setMeetingName] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [guests, setGuests] = useState<PartifulGuest[] | null>(null);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [manualMatches, setManualMatches] = useState<Record<number, { id: number; name: string }>>({});
  const [matchPickerIndex, setMatchPickerIndex] = useState<number | null>(null);
  // Per-guest engagement level (guest index -> level value). Absent = no change.
  const [guestLevels, setGuestLevels] = useState<Record<number, string>>({});

  const reset = () => {
    setResult(null);
    setGuests(null);
    setFileName('');
    setSelectedMeetingId(null);
    setMeetingName('');
    setMeetingDate('');
    setMeetingLocation('');
    setManualMatches({});
    setMatchPickerIndex(null);
    setGuestLevels({});
  };

  const selectExisting = (m: MeetingWithAttendance) => {
    setSelectedMeetingId(m.id);
    setMeetingName(m.name);
    setMeetingDate(m.date);
    setMeetingLocation((m as any).location || '');
  };

  const applyLevelToAll = (level: string) => {
    if (!guests) return;
    if (level === NO_LEVEL) {
      setGuestLevels({});
      return;
    }
    const next: Record<number, string> = {};
    for (let i = 0; i < guests.length; i++) next[i] = level;
    setGuestLevels(next);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const lower = (s: string) => s.toLowerCase().replace(/[\s_-]/g, '');

        const nameCol = headers.find((h) => ['name', 'fullname', 'guestname', 'firstname'].includes(lower(h)))
          || headers.find((h) => lower(h).includes('name'));
        const emailCol = headers.find((h) => ['email', 'emailaddress', 'mail'].includes(lower(h)))
          || headers.find((h) => lower(h).includes('email') || lower(h).includes('mail'));
        const phoneCol = headers.find((h) => ['phone', 'phonenumber', 'mobile', 'cell'].includes(lower(h)))
          || headers.find((h) => lower(h).includes('phone'));
        const rsvpCol = headers.find((h) => ['rsvp', 'rsvpstatus', 'status', 'response'].includes(lower(h)))
          || headers.find((h) => lower(h).includes('rsvp') || lower(h).includes('status'));

        const parsed: PartifulGuest[] = [];
        for (const row of results.data as Record<string, string>[]) {
          const name = (nameCol ? row[nameCol] : '').trim();
          const email = (emailCol ? row[emailCol] : '').trim() || null;
          const phone = (phoneCol ? row[phoneCol] : '').trim() || null;
          const rsvpStatus = (rsvpCol ? row[rsvpCol] : '').trim() || null;
          if (!name && !email) continue;
          parsed.push({ name, email, phone, rsvpStatus });
        }
        setGuests(parsed);
        setGuestLevels({});

        if (!meetingName) {
          const suggested = file.name
            .replace(/\.csv$/i, '')
            .replace(/[-_]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (suggested) setMeetingName(suggested);
        }
      },
    });
  };

  const handleImport = () => {
    if (!guests || !meetingName.trim() || !meetingDate) return;
    startTransition(async () => {
      const matchMap = Object.keys(manualMatches).length > 0
        ? Object.fromEntries(Object.entries(manualMatches).map(([idx, c]) => [Number(idx), c.id]))
        : undefined;
      const levelMap = Object.keys(guestLevels).length > 0 ? guestLevels : undefined;
      const res = await importPartifulAction(
        selectedMeetingId,
        meetingName.trim(),
        meetingDate,
        meetingLocation.trim() || null,
        guests,
        matchMap,
        levelMap,
      );
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      setResult(res.result);
      toast.success(`Imported ${res.result.total} guests for "${res.result.meetingName}"`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <PartyPopper className="h-4 w-4 mr-2" />
        Partiful event import
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Partiful event import</DialogTitle>
          <DialogDescription>
            Upload a guest list CSV exported from Partiful. Existing contacts
            will be marked as attended; new guests will be added to the CRM and
            tagged for the next MailerLite sync. Optionally set each guest&rsquo;s
            engagement level.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-emerald-500">
              <Check className="h-4 w-4" /> Import complete
            </div>
            <div className="rounded-md border border-border/50 divide-y divide-border/30">
              <ResultRow icon={<CalendarDays className="h-4 w-4 text-blue-500" />} label="Meeting" text={result.meetingName} />
              <ResultRow icon={<Users className="h-4 w-4 text-blue-500" />} label="Existing contacts matched" value={result.matched} />
              <ResultRow icon={<UserPlus className="h-4 w-4 text-violet-500" />} label="New contacts created" value={result.created} />
              {result.levelsUpdated > 0 && (
                <ResultRow icon={<TrendingUp className="h-4 w-4 text-amber-500" />} label="Engagement levels set" value={result.levelsUpdated} />
              )}
              {result.alreadyAttended > 0 && (
                <ResultRow label="Already marked attended" value={result.alreadyAttended} muted />
              )}
              <ResultRow label="Tagged for MailerLite sync" value={result.taggedNewsletter} muted />
              <ResultRow label="Total guests in CSV" value={result.total} muted />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pick existing meeting or create new */}
            <div className="space-y-2">
              <Label>Meeting</Label>
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
                      onClick={() => selectExisting(m)}
                    >
                      {m.name}
                    </button>
                  ))}
                  {selectedMeetingId && (
                    <button
                      type="button"
                      className="text-xs px-2 py-0.5 rounded-full border border-border/50 text-muted-foreground hover:border-foreground/30"
                      onClick={() => { setSelectedMeetingId(null); setMeetingName(''); setMeetingDate(''); setMeetingLocation(''); }}
                    >
                      + New meeting
                    </button>
                  )}
                </div>
              )}
              {!selectedMeetingId && (
                <Input
                  placeholder="Meeting name"
                  value={meetingName}
                  onChange={(e) => setMeetingName(e.target.value)}
                />
              )}
            </div>

            {/* Date (required for new meetings) */}
            {!selectedMeetingId && (
              <div className="space-y-2">
                <Label htmlFor="partiful-date">Date</Label>
                <Input
                  id="partiful-date"
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                />
              </div>
            )}

            {/* Location (optional for new meetings) */}
            {!selectedMeetingId && (
              <div className="space-y-2">
                <Label htmlFor="partiful-location">Location <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  id="partiful-location"
                  placeholder="e.g. Community center"
                  value={meetingLocation}
                  onChange={(e) => setMeetingLocation(e.target.value)}
                />
              </div>
            )}

            {/* File upload */}
            <div className="space-y-2">
              <Label>Guest list CSV</Label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFile}
              />
              <Button
                variant="outline"
                className="w-full justify-start text-muted-foreground"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {fileName || 'Choose CSV file…'}
              </Button>
              {guests && guests.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs text-muted-foreground">
                      {guests.length} guest{guests.length !== 1 ? 's' : ''} found in file
                    </p>
                    {/* Bulk level applier */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Set level for all:</span>
                      <Select onValueChange={applyLevelToAll}>
                        <SelectTrigger className="h-7 text-xs w-40">
                          <SelectValue placeholder="Choose…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_LEVEL}>No change</SelectItem>
                          {ENGAGEMENT_LEVELS.map((lvl) => (
                            <SelectItem key={lvl.value} value={lvl.value}>{lvl.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded-md border border-border/50 bg-muted/20 divide-y divide-border/30">
                    {guests.map((guest, i) => {
                      const autoMatch = findMatchingContact(
                        guest.name,
                        guest.email,
                        existingContacts.map((c) => ({ id: c.id, name: c.name, email: c.email || null })),
                      );
                      const manual = manualMatches[i];
                      const isMatched = !!autoMatch || !!manual;

                      return (
                        <div key={i}>
                          <div className="flex items-center gap-2 px-3 py-1.5">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm truncate">{guest.name || guest.email || '(no name)'}</div>
                              {guest.email && guest.name && (
                                <div className="text-xs text-muted-foreground truncate">{guest.email}</div>
                              )}
                            </div>
                            {/* Per-guest engagement level */}
                            <Select
                              value={guestLevels[i] ?? NO_LEVEL}
                              onValueChange={(v) =>
                                setGuestLevels((p) => {
                                  const n = { ...p };
                                  if (v === NO_LEVEL) delete n[i];
                                  else n[i] = v;
                                  return n;
                                })
                              }
                            >
                              <SelectTrigger className="h-7 text-xs w-28 shrink-0">
                                <SelectValue placeholder="Level" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NO_LEVEL}>No level</SelectItem>
                                {ENGAGEMENT_LEVELS.map((lvl) => (
                                  <SelectItem key={lvl.value} value={lvl.value}>{lvl.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {manual ? (
                                <>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-purple-500/30 text-purple-500">
                                    → {manual.name}
                                  </Badge>
                                  <button
                                    onClick={() => setManualMatches((p) => { const n = { ...p }; delete n[i]; return n; })}
                                    className="text-[10px] text-muted-foreground hover:text-foreground"
                                  >
                                    ✕
                                  </button>
                                </>
                              ) : autoMatch ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-blue-500/30 text-blue-500">
                                  Existing
                                </Badge>
                              ) : (
                                <>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-violet-500/30 text-violet-500">
                                    New
                                  </Badge>
                                  <button
                                    onClick={() => setMatchPickerIndex(matchPickerIndex === i ? null : i)}
                                    className="text-[10px] text-primary hover:underline whitespace-nowrap"
                                  >
                                    Match
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          {matchPickerIndex === i && (
                            <div className="px-3 pb-2">
                              <ContactMatchPicker
                                contacts={existingContacts}
                                onSelect={(c) => {
                                  setManualMatches((p) => ({ ...p, [i]: c }));
                                  setMatchPickerIndex(null);
                                }}
                                onCancel={() => setMatchPickerIndex(null)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {guests && guests.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No guests found in file
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => { setOpen(false); reset(); }} disabled={pending}>
            Close
          </Button>
          {!result && (
            <Button
              onClick={handleImport}
              disabled={pending || !guests || guests.length === 0 || !meetingName.trim() || (!selectedMeetingId && !meetingDate)}
            >
              {pending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing…</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Import {guests?.length ?? 0} guests</>
              )}
            </Button>
          )}
          {result && (
            <Button onClick={reset}>
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
