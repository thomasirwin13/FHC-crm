'use client';

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Upload, FileText, Check, X, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import { matchNewsletterSubscribersAction } from './match-newsletter-action';
import { toast } from 'sonner';

interface MatchNewsletterDialogProps {
  existingContacts: { id: number; name: string; email?: string | null }[];
}

interface ParsedSubscriber {
  name: string;
  email: string;
}

interface MatchResult {
  matched: number;
  alreadyTagged: number;
  unmatched: string[];
}

export default function MatchNewsletterDialog({ existingContacts }: MatchNewsletterDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [subscribers, setSubscribers] = useState<ParsedSubscriber[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [fileName, setFileName] = useState('');

  const reset = () => {
    setStep('upload');
    setSubscribers([]);
    setResult(null);
    setFileName('');
  };

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        const parsed: ParsedSubscriber[] = [];

        for (const row of rows) {
          const keys = Object.keys(row);
          const lower = (s: string) => s.toLowerCase().replace(/[\s_-]/g, '');

          const emailKey = keys.find((k) => ['email', 'emailaddress', 'mail'].includes(lower(k)));
          const nameKey = keys.find((k) => ['name', 'fullname', 'contactname', 'firstname'].includes(lower(k)));

          const email = emailKey ? row[emailKey]?.trim() : '';
          const name = nameKey ? row[nameKey]?.trim() : '';

          if (email && email.includes('@')) {
            parsed.push({ name: name || email.split('@')[0], email: email.toLowerCase() });
          }
        }

        if (parsed.length === 0) {
          toast.error('No valid email addresses found in the CSV');
          return;
        }

        setSubscribers(parsed);
        setStep('preview');
      },
      error: () => {
        toast.error('Failed to parse CSV file');
      },
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      handleFile(file);
    } else {
      toast.error('Please upload a CSV file');
    }
  }, [handleFile]);

  const previewMatches = subscribers.map((sub) => {
    const match = existingContacts.find(
      (c) => c.email?.toLowerCase().trim() === sub.email
    );
    return { ...sub, match };
  });

  const matchedCount = previewMatches.filter((p) => p.match).length;
  const unmatchedCount = previewMatches.filter((p) => !p.match).length;

  const handleSubmit = async () => {
    const emails = subscribers.map((s) => s.email);
    setLoading(true);
    const res = await matchNewsletterSubscribersAction(emails);
    setLoading(false);

    if ('error' in res && res.error) {
      toast.error(res.error);
      return;
    }

    setResult(res as MatchResult);
    setStep('result');
    toast.success(`Tagged ${(res as MatchResult).matched} contact${(res as MatchResult).matched !== 1 ? 's' : ''} as newsletter subscribers`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex-shrink-0 border-border hover:bg-accent hover:border-foreground/20 transition-all duration-150"
        >
          <Mail className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Match subscribers</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Match newsletter subscribers</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV with email addresses (and optionally names) to tag matching contacts as "Newsletter subscriber".
            </p>
            <div
              className="border-2 border-dashed border-border/60 rounded-lg p-8 text-center hover:border-primary/40 transition-colors cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => document.getElementById('newsletter-csv-input')?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Drop a CSV here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">
                Columns: email (required), name (optional)
              </p>
            </div>
            <Input
              id="newsletter-csv-input"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{fileName}</span>
              <span className="text-muted-foreground">- {subscribers.length} email{subscribers.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="flex gap-3">
              <div className="flex-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
                <div className="text-2xl font-bold text-emerald-500">{matchedCount}</div>
                <div className="text-xs text-muted-foreground">matched</div>
              </div>
              <div className="flex-1 rounded-md border border-border/50 bg-muted/20 p-3 text-center">
                <div className="text-2xl font-bold text-muted-foreground">{unmatchedCount}</div>
                <div className="text-xs text-muted-foreground">not in CRM</div>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto border border-border/50 rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium text-muted-foreground">Email</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewMatches.map((p, i) => (
                    <tr key={i} className="border-t border-border/30">
                      <td className="p-2 text-xs truncate max-w-[200px]">{p.email}</td>
                      <td className="p-2">
                        {p.match ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                            <Check className="h-3 w-3" /> {p.match.name}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <X className="h-3 w-3" /> No match
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {matchedCount === 0 && (
              <p className="text-sm text-amber-500">No matching contacts found. Check that email addresses match.</p>
            )}
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Check className="h-5 w-5 text-emerald-500" />
                <span className="font-medium text-emerald-500">Done</span>
              </div>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>{result.matched} contact{result.matched !== 1 ? 's' : ''} tagged as "Newsletter subscriber"</li>
                {result.alreadyTagged > 0 && (
                  <li>{result.alreadyTagged} already had the tag</li>
                )}
                {result.unmatched.length > 0 && (
                  <li>{result.unmatched.length} email{result.unmatched.length !== 1 ? 's' : ''} not found in CRM</li>
                )}
              </ul>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'preview' && (
            <div className="flex gap-2 w-full justify-end">
              <Button variant="outline" onClick={reset}>Back</Button>
              <Button onClick={handleSubmit} disabled={loading || matchedCount === 0}>
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Matching...</>
                ) : (
                  <>Tag {matchedCount} contact{matchedCount !== 1 ? 's' : ''}</>
                )}
              </Button>
            </div>
          )}
          {step === 'result' && (
            <Button onClick={() => { setOpen(false); reset(); }}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
