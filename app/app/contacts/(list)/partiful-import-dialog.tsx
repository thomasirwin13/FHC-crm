'use client';

import { useState, useRef, useTransition, useEffect } from 'react';
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
  PartyPopper,
  Upload,
  Loader2,
  Check,
  UserPlus,
  Users,
  CalendarDays,
} from 'lucide-react';
import Papa from 'papaparse';
import {
  importPartifulEventAction,
  getEventsAction,
  PartifulGuest,
  PartifulImportResult,
} from './partiful-import-action';
import { toast } from 'sonner';

export default function PartifulImportDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<PartifulImportResult | null>(null);
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [guests, setGuests] = useState<PartifulGuest[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [existingEvents, setExistingEvents] = useState<{ id: number; name: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      getEventsAction().then(setExistingEvents);
    }
  }, [open]);

  const reset = () => {
    setResult(null);
    setGuests(null);
    setFileName('');
    setEventName('');
    setEventDate('');
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

        // Detect columns flexibly
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

        // Try to auto-suggest event name from file name
        if (!eventName) {
          const suggested = file.name
            .replace(/\.csv$/i, '')
            .replace(/[-_]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (suggested) setEventName(suggested);
        }
      },
    });
  };

  const handleImport = () => {
    if (!guests || !eventName.trim()) return;
    startTransition(async () => {
      const res = await importPartifulEventAction(
        eventName.trim(),
        eventDate || null,
        guests
      );
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      setResult(res.result);
      toast.success(`Imported ${res.result.total} guests for "${res.result.eventName}"`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <Button
        variant="outline"
        size="sm"
        className="flex-shrink-0"
        onClick={() => setOpen(true)}
      >
        <PartyPopper className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">Partiful</span>
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Partiful event</DialogTitle>
          <DialogDescription>
            Upload a guest list CSV exported from Partiful. Existing contacts
            will be marked as attended; new guests will be added to the CRM and
            tagged for the next MailerLite sync.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-emerald-500">
              <Check className="h-4 w-4" /> Import complete
            </div>
            <div className="rounded-md border border-border/50 divide-y divide-border/30">
              <ResultRow icon={<CalendarDays className="h-4 w-4 text-blue-500" />} label="Event" text={result.eventName} />
              <ResultRow icon={<Users className="h-4 w-4 text-blue-500" />} label="Existing contacts matched" value={result.matched} />
              <ResultRow icon={<UserPlus className="h-4 w-4 text-violet-500" />} label="New contacts created" value={result.created} />
              {result.alreadyAttended > 0 && (
                <ResultRow label="Already marked attended" value={result.alreadyAttended} muted />
              )}
              <ResultRow label="Tagged for MailerLite sync" value={result.taggedNewsletter} muted />
              <ResultRow label="Total guests in CSV" value={result.total} muted />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Event name */}
            <div className="space-y-2">
              <Label htmlFor="event-name">Event name</Label>
              {existingEvents.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {existingEvents.slice(0, 5).map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        eventName === ev.name
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border/50 text-muted-foreground hover:border-foreground/30'
                      }`}
                      onClick={() => setEventName(ev.name)}
                    >
                      {ev.name}
                    </button>
                  ))}
                </div>
              )}
              <Input
                id="event-name"
                placeholder="e.g. Monthly housing meeting - July 2026"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
              />
            </div>

            {/* Event date (optional) */}
            <div className="space-y-2">
              <Label htmlFor="event-date">Event date <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                id="event-date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>

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
              {guests && (
                <p className="text-xs text-muted-foreground">
                  {guests.length} guest{guests.length !== 1 ? 's' : ''} found in file
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
              disabled={pending || !guests || guests.length === 0 || !eventName.trim()}
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
