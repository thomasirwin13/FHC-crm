'use client';

import { useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Upload, FileText, X, ArrowRight, Search, RefreshCw } from 'lucide-react';
import Papa from 'papaparse';
import { bulkCreateContactsAction, updateContactsFromCsvAction } from '@/app/app/organizations/[id]/contact-actions';
import { toast } from 'sonner';

const APP_FIELDS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'street', label: 'Street' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zip', label: 'Zip' },
  { key: 'engagement_level', label: 'Engagement level', hint: 'Activist/Attender/Participator/Learner/Potential or 4–0' },
  { key: 'action_committed', label: 'Committed to weekly action', hint: 'yes / no' },
  { key: 'preferred_contact_method', label: 'Preferred contact method', hint: 'custom_email / email_newsletter / custom_text / whatsapp' },
  { key: 'categories', label: 'Categories', hint: 'Comma-separated names, e.g. "Newsletter, WhatsApp"' },
] as const;

type AppFieldKey = typeof APP_FIELDS[number]['key'];
type ColumnMapping = Record<AppFieldKey, string>;

function guessMapping(csvColumns: string[]): ColumnMapping {
  const mapping: Partial<ColumnMapping> = {};
  const lower = (s: string) => s.toLowerCase().replace(/[\s_-]/g, '');

  const matchers: Record<AppFieldKey, string[]> = {
    name: ['name', 'fullname', 'contactname'],
    email: ['email', 'emailaddress', 'mail'],
    phone: ['phone', 'phonenumber', 'mobile', 'cell', 'telephone'],
    street: ['street', 'address', 'streetaddress', 'address1'],
    city: ['city'],
    state: ['state', 'province', 'region'],
    zip: ['zip', 'zipcode', 'postalcode', 'postal'],
    engagement_level: ['engagementlevel', 'level', 'activistlevel', 'engagement'],
    action_committed: ['actioncommitted', 'committed', 'weeklyaction', 'weekly'],
    preferred_contact_method: ['preferredcontactmethod', 'preferredmethod', 'contactmethod', 'preferredcontact'],
    categories: ['categories', 'tags', 'groups', 'lists'],
  };

  for (const field of APP_FIELDS) {
    const candidates = matchers[field.key];
    const match = csvColumns.find(col => candidates.includes(lower(col)));
    mapping[field.key] = match || '';
  }

  return mapping as ColumnMapping;
}

interface ExistingContact {
  id: number;
  name: string;
  email?: string | null;
}

interface UploadContactsCsvDialogProps {
  existingContacts?: ExistingContact[];
}

// Inline picker shown in the preview table when user clicks "Match"
function MatchPicker({
  csvRow,
  existingContacts,
  onMatch,
  onClose,
}: {
  csvRow: { name: string; email: string };
  existingContacts: ExistingContact[];
  onMatch: (contactId: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) {
      // Show contacts with similar name first
      const q = csvRow.name.toLowerCase();
      return [...existingContacts].sort((a, b) => {
        const aMatch = a.name.toLowerCase().includes(q) ? 0 : 1;
        const bMatch = b.name.toLowerCase().includes(q) ? 0 : 1;
        return aMatch - bMatch;
      }).slice(0, 50);
    }
    const q = query.toLowerCase();
    return existingContacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [existingContacts, query, csvRow.name]);

  return (
    <div className="mt-1 border border-border rounded-lg bg-popover shadow-md p-2 space-y-1.5 min-w-[260px]" onClick={(e) => e.stopPropagation()}>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search contacts…"
          className="h-7 pl-7 text-xs"
          autoFocus
        />
      </div>
      <div className="max-h-36 overflow-y-auto divide-y divide-border/30">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 text-center">No contacts found</p>
        ) : (
          filtered.map((c) => (
            <button
              key={c.id}
              className="w-full text-left px-2 py-1.5 hover:bg-muted/60 transition-colors rounded"
              onClick={() => onMatch(c.id)}
            >
              <span className="text-xs font-medium block truncate">{c.name}</span>
              {c.email && <span className="text-xs text-muted-foreground block truncate">{c.email}</span>}
            </button>
          ))
        )}
      </div>
      <Button size="sm" variant="ghost" className="w-full h-6 text-xs" onClick={onClose}>Cancel</Button>
    </div>
  );
}

export default function UploadContactsCsvDialog({ existingContacts = [] }: UploadContactsCsvDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({} as ColumnMapping);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  // row index → existing contact id that will get its email updated
  const [manualMatches, setManualMatches] = useState<Record<number, number>>({});
  // row index of the picker currently open
  const [pickerOpen, setPickerOpen] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingById = useMemo(() => {
    const m: Record<number, ExistingContact> = {};
    existingContacts.forEach((c) => { m[c.id] = c; });
    return m;
  }, [existingContacts]);

  const existingEmails = useMemo(() =>
    new Set(existingContacts.map((c) => c.email?.toLowerCase().trim()).filter(Boolean) as string[]),
    [existingContacts]
  );
  const existingNames = useMemo(() =>
    new Set(existingContacts.map((c) => c.name.toLowerCase().trim())),
    [existingContacts]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    if (!selectedFile.name.endsWith('.csv')) { setError('Please select a CSV file'); return; }
    setFile(selectedFile);
    setError(null);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const cols = results.meta.fields || [];
        const rows = results.data as Record<string, string>[];
        setCsvColumns(cols);
        setRawRows(rows);
        setMapping(guessMapping(cols));
        setManualMatches({});
        setPickerOpen(null);
        setStep('map');
      },
      error: (err) => setError(`Error parsing CSV: ${err.message}`),
    });
  };

  const mappedContacts = rawRows.map(row => ({
    name: mapping.name ? row[mapping.name] || '' : '',
    email: mapping.email ? row[mapping.email] || '' : '',
    phone: mapping.phone ? row[mapping.phone] || '' : '',
    street: mapping.street ? row[mapping.street] || '' : '',
    city: mapping.city ? row[mapping.city] || '' : '',
    state: mapping.state ? row[mapping.state] || '' : '',
    zip: mapping.zip ? row[mapping.zip] || '' : '',
    engagement_level: mapping.engagement_level ? row[mapping.engagement_level] || '' : '',
    action_committed: mapping.action_committed ? row[mapping.action_committed] || '' : '',
    preferred_contact_method: mapping.preferred_contact_method ? row[mapping.preferred_contact_method] || '' : '',
    categories: mapping.categories ? row[mapping.categories] || '' : '',
  })).filter(c => c.name.trim());

  const isDuplicate = (contact: { name: string; email: string }) => {
    if (contact.email && existingEmails.has(contact.email.toLowerCase().trim())) return true;
    if (existingNames.has(contact.name.toLowerCase().trim())) return true;
    return false;
  };

  // Contacts that will be created fresh (not duplicates, not manually matched)
  const newContacts = mappedContacts.filter((c, i) => !isDuplicate(c) && !(i in manualMatches));
  // Contacts that are duplicates but not manually matched (will be skipped if skipDuplicates)
  const unhandledDuplicates = mappedContacts.filter((c, i) => isDuplicate(c) && !(i in manualMatches));
  // Contacts that have been manually matched → will update existing contact's email
  const matchedUpdates = Object.entries(manualMatches).map(([idxStr, contactId]) => {
    const idx = Number(idxStr);
    const csvRow = mappedContacts[idx];
    return { contactId, email: csvRow?.email || '' };
  });

  const contactsToCreate = skipDuplicates
    ? newContacts
    : [...newContacts, ...unhandledDuplicates];

  const duplicateCount = unhandledDuplicates.length;
  const totalImporting = contactsToCreate.length + matchedUpdates.length;

  const handleMatch = (rowIndex: number, contactId: number) => {
    setManualMatches((prev) => ({ ...prev, [rowIndex]: contactId }));
    setPickerOpen(null);
  };

  const handleUnmatch = (rowIndex: number) => {
    setManualMatches((prev) => {
      const next = { ...prev };
      delete next[rowIndex];
      return next;
    });
  };

  const handleUpload = async () => {
    if (totalImporting === 0) { setError('No contacts to import'); return; }
    setLoading(true);
    setError(null);
    try {
      const results: string[] = [];

      if (contactsToCreate.length > 0) {
        const result = await bulkCreateContactsAction(contactsToCreate);
        if (result.error) { setError(result.error); setLoading(false); return; }
        results.push(result.success || `${contactsToCreate.length} created`);
      }

      if (matchedUpdates.length > 0) {
        const result = await updateContactsFromCsvAction(matchedUpdates);
        if (result.error) { setError(result.error); setLoading(false); return; }
        results.push(result.success || `${matchedUpdates.length} updated`);
      }

      toast.success(results.join(' · '));
      handleClose();
      window.location.reload();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setStep('upload');
    setFile(null);
    setCsvColumns([]);
    setRawRows([]);
    setMapping({} as ColumnMapping);
    setManualMatches({});
    setPickerOpen(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex-shrink-0 border-border hover:bg-accent hover:border-foreground/20 transition-all duration-150">
          <Upload className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Import CSV</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import contacts from CSV</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Select a CSV file to get started.'}
            {step === 'map' && 'Match your CSV columns to the correct contact fields.'}
            {step === 'preview' && `Preview ${contactsToCreate.length} new${matchedUpdates.length > 0 ? ` + ${matchedUpdates.length} email update${matchedUpdates.length !== 1 ? 's' : ''}` : ''}${duplicateCount > 0 ? ` · ${duplicateCount} unmatched duplicate${duplicateCount !== 1 ? 's' : ''}` : ''}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="border-2 border-dashed border-border rounded-lg p-10 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">Select a CSV file to upload</p>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" id="contacts-csv-upload" />
              <label htmlFor="contacts-csv-upload">
                <Button asChild variant="outline"><span>Choose file</span></Button>
              </label>
              {error && <p className="text-sm text-destructive mt-3">{error}</p>}
            </div>
          )}

          {/* Step 2: Column mapping */}
          {step === 'map' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted rounded-md">
                <FileText className="h-4 w-4 flex-shrink-0" />
                <span>{file?.name} — {rawRows.length} rows, {csvColumns.length} columns detected</span>
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr className="border-b border-border">
                      <th className="text-left p-3 font-medium text-muted-foreground w-2/5">Contact field</th>
                      <th className="text-left p-3 font-medium text-muted-foreground w-3/5">CSV column</th>
                    </tr>
                  </thead>
                  <tbody>
                    {APP_FIELDS.map(field => (
                      <tr key={field.key} className="border-b border-border last:border-0">
                        <td className="p-3">
                          <div className="font-medium">
                            {field.label}
                            {'required' in field && field.required && <span className="text-destructive ml-1">*</span>}
                          </div>
                          {'hint' in field && field.hint && (
                            <div className="text-xs text-muted-foreground mt-0.5">{field.hint}</div>
                          )}
                        </td>
                        <td className="p-3">
                          <Select
                            value={mapping[field.key] || '__none__'}
                            onValueChange={val => setMapping(prev => ({ ...prev, [field.key]: val === '__none__' ? '' : val }))}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="— skip —" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— skip —</SelectItem>
                              {csvColumns.map(col => (
                                <SelectItem key={col} value={col}>{col}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-3">
              {duplicateCount > 0 && (
                <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-sm">
                  <span className="text-yellow-700 dark:text-yellow-400">
                    {duplicateCount} row{duplicateCount !== 1 ? 's' : ''} match existing contacts. Use the <strong>Match</strong> button to update their email, or skip them.
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-xs font-medium">Skip unmatched</span>
                  </label>
                </div>
              )}
              <div className="border border-border rounded-lg overflow-auto max-h-[50vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted z-10">
                    <tr className="border-b border-border">
                      <th className="text-left p-2 font-medium text-muted-foreground">Name</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Email</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Level</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Categories</th>
                      <th className="text-left p-2 font-medium text-muted-foreground w-32">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedContacts.map((row, i) => {
                      const dup = isDuplicate(row);
                      const matchedContactId = manualMatches[i];
                      const matchedContact = matchedContactId !== undefined ? existingById[matchedContactId] : undefined;
                      const isSkipped = dup && !matchedContact && skipDuplicates;

                      return (
                        <tr key={i} className={`border-b border-border last:border-0 align-top ${isSkipped ? 'opacity-40' : ''}`}>
                          <td className="p-2 font-medium">{row.name}</td>
                          <td className="p-2 text-muted-foreground">
                            {matchedContact ? (
                              <span className="text-xs">
                                <span className="line-through opacity-50">{matchedContact.email || '—'}</span>
                                {' → '}
                                <span className="text-green-600 dark:text-green-400 font-medium">{row.email || '—'}</span>
                              </span>
                            ) : (
                              row.email || '—'
                            )}
                          </td>
                          <td className="p-2 text-muted-foreground capitalize text-xs">{row.engagement_level || 'potential'}</td>
                          <td className="p-2 text-muted-foreground text-xs">{row.categories || '—'}</td>
                          <td className="p-2">
                            {matchedContact ? (
                              <div className="flex flex-col gap-1">
                                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-400 font-medium inline-block w-fit">
                                  update email
                                </span>
                                <span className="text-xs text-muted-foreground truncate max-w-[120px]">→ {matchedContact.name}</span>
                                <button
                                  onClick={() => handleUnmatch(i)}
                                  className="text-xs text-muted-foreground hover:text-foreground underline text-left"
                                >
                                  Unmatch
                                </button>
                              </div>
                            ) : dup ? (
                              <div>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 font-medium inline-block w-fit mb-1">
                                  duplicate
                                </span>
                                <br />
                                <button
                                  onClick={() => setPickerOpen(pickerOpen === i ? null : i)}
                                  className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                  Match &amp; update email
                                </button>
                                {pickerOpen === i && (
                                  <MatchPicker
                                    csvRow={row}
                                    existingContacts={existingContacts}
                                    onMatch={(contactId) => handleMatch(i, contactId)}
                                    onClose={() => setPickerOpen(null)}
                                  />
                                )}
                              </div>
                            ) : (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/15 text-green-700 dark:text-green-400 font-medium">
                                new
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 pt-4 border-t border-border">
          <Button variant="outline" onClick={handleClose} disabled={loading}>Cancel</Button>
          <div className="flex gap-2">
            {step === 'map' && (
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
            )}
            {step === 'preview' && (
              <Button variant="outline" onClick={() => setStep('map')}>Back</Button>
            )}
            {step === 'map' && (
              <Button
                onClick={() => {
                  if (!mapping.name) { setError('Please map the Name field — it is required'); return; }
                  setError(null);
                  setStep('preview');
                }}
                disabled={mappedContacts.length === 0}
              >
                Preview {mappedContacts.length} contact{mappedContacts.length !== 1 ? 's' : ''} <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 'preview' && (
              <Button onClick={handleUpload} disabled={loading || totalImporting === 0}>
                {loading ? 'Importing…' : totalImporting === 0 ? 'Nothing to import' : [
                  contactsToCreate.length > 0 ? `Create ${contactsToCreate.length}` : '',
                  matchedUpdates.length > 0 ? `Update ${matchedUpdates.length}` : '',
                ].filter(Boolean).join(' · ')}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
