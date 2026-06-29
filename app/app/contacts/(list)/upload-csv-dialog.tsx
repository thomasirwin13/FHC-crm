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
import { Upload, FileText, ArrowRight, Search, X } from 'lucide-react';
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
    const match = csvColumns.find(col => matchers[field.key].includes(lower(col)));
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

function ContactPickerDialog({
  existingContacts,
  onSelect,
  onClose,
}: {
  existingContacts: ExistingContact[];
  onSelect: (contact: ExistingContact) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    if (!query.trim()) return existingContacts.slice(0, 80);
    const q = query.toLowerCase();
    return existingContacts.filter(c =>
      c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
    ).slice(0, 80);
  }, [existingContacts, query]);

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select existing contact</DialogTitle>
          <DialogDescription>Choose which contact to update the email for.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9"
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto border border-border/50 rounded-lg divide-y divide-border/30">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No contacts found.</p>
          ) : filtered.map(c => (
            <button
              key={c.id}
              className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors"
              onClick={() => onSelect(c)}
            >
              <div className="font-medium text-sm">{c.name}</div>
              {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </DialogContent>
    </Dialog>
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
  // row index → matched existing contact (null = skip/no update)
  const [matches, setMatches] = useState<Record<number, ExistingContact | null>>({});
  const [changingMatchFor, setChangingMatchFor] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingByEmail = useMemo(() => {
    const m: Record<string, ExistingContact> = {};
    existingContacts.forEach(c => { if (c.email) m[c.email.toLowerCase().trim()] = c; });
    return m;
  }, [existingContacts]);

  const existingByName = useMemo(() => {
    const m: Record<string, ExistingContact> = {};
    existingContacts.forEach(c => { m[c.name.toLowerCase().trim()] = c; });
    return m;
  }, [existingContacts]);

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
        setMatches({});
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

  // Auto-detect the best match for a CSV row
  const autoDetectMatch = (row: { name: string; email: string }): ExistingContact | null => {
    if (row.email) {
      const byEmail = existingByEmail[row.email.toLowerCase().trim()];
      if (byEmail) return byEmail;
    }
    const byName = existingByName[row.name.toLowerCase().trim()];
    return byName || null;
  };

  // Build the effective match for each row: explicit match state, or auto-detected, or null
  const effectiveMatches: (ExistingContact | null)[] = mappedContacts.map((row, i) => {
    if (i in matches) return matches[i]; // explicit (could be null if user skipped)
    return autoDetectMatch(row);
  });

  const contactsToCreate = mappedContacts.filter((_, i) => effectiveMatches[i] === null || effectiveMatches[i] === undefined ? !autoDetectMatch(mappedContacts[i]) : false);
  // new contacts: rows with no match at all
  const newRows = mappedContacts.filter((row, i) => {
    const m = effectiveMatches[i];
    return m === null ? false : !autoDetectMatch(row) && !(i in matches);
  });

  // Simpler: categorize each row
  const rowCategories = mappedContacts.map((row, i) => {
    const effective = effectiveMatches[i];
    if (effective) return 'update' as const;        // will update email
    if (effective === null) return 'skip' as const;  // explicitly skipped by user
    // no match found at all → new
    return 'new' as const;
  });

  const toCreate = mappedContacts.filter((_, i) => rowCategories[i] === 'new');
  const toUpdate = mappedContacts.map((row, i) => ({
    row,
    contact: effectiveMatches[i]!,
  })).filter((_, i) => rowCategories[i] === 'update');

  const totalMatched = toUpdate.length;
  const totalNew = toCreate.length;
  const totalSkipped = rowCategories.filter(c => c === 'skip').length;

  const goToPreview = () => {
    if (!mapping.name) { setError('Please map the Name field — it is required'); return; }
    setError(null);
    // Reset explicit overrides so auto-detection kicks in fresh
    setMatches({});
    setStep('preview');
  };

  const handleUpload = async () => {
    if (toCreate.length === 0 && toUpdate.length === 0) {
      setError('No contacts to import');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results: string[] = [];

      if (toCreate.length > 0) {
        const result = await bulkCreateContactsAction(toCreate);
        if (result.error) { setError(result.error); setLoading(false); return; }
        results.push(result.success || `${toCreate.length} created`);
      }

      if (toUpdate.length > 0) {
        const updates = toUpdate.map(({ row, contact }) => ({
          contactId: contact.id,
          email: row.email,
        }));
        const result = await updateContactsFromCsvAction(updates);
        if (result.error) { setError(result.error); setLoading(false); return; }
        results.push(result.success || `${toUpdate.length} updated`);
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
    setMatches({});
    setChangingMatchFor(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      {changingMatchFor !== null && (
        <ContactPickerDialog
          existingContacts={existingContacts}
          onSelect={(contact) => {
            setMatches(prev => ({ ...prev, [changingMatchFor]: contact }));
            setChangingMatchFor(null);
          }}
          onClose={() => setChangingMatchFor(null)}
        />
      )}

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
              {step === 'preview' && `${totalNew} new${totalMatched > 0 ? ` · ${totalMatched} email update${totalMatched !== 1 ? 's' : ''}` : ''}${totalSkipped > 0 ? ` · ${totalSkipped} skipped` : ''}`}
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
                {totalMatched > 0 && (
                  <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/20 text-sm text-blue-700 dark:text-blue-400">
                    <strong>{totalMatched} row{totalMatched !== 1 ? 's' : ''}</strong> matched existing contacts by name or email — their email addresses will be updated. You can change or skip any match below.
                  </div>
                )}

                <div className="border border-border rounded-lg overflow-auto max-h-[50vh]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted z-10">
                      <tr className="border-b border-border">
                        <th className="text-left p-2 font-medium text-muted-foreground">CSV name</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Email (new)</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Action</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Matched to</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappedContacts.map((row, i) => {
                        const category = rowCategories[i];
                        const matched = effectiveMatches[i];

                        return (
                          <tr key={i} className={`border-b border-border last:border-0 ${category === 'skip' ? 'opacity-40' : ''}`}>
                            <td className="p-2 font-medium">{row.name}</td>
                            <td className="p-2 text-muted-foreground text-xs">{row.email || '—'}</td>
                            <td className="p-2">
                              {category === 'new' && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/15 text-green-700 dark:text-green-400 font-medium">
                                  create new
                                </span>
                              )}
                              {category === 'update' && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-400 font-medium">
                                  update email
                                </span>
                              )}
                              {category === 'skip' && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                                  skip
                                </span>
                              )}
                            </td>
                            <td className="p-2">
                              {category === 'update' && matched ? (
                                <div className="flex items-center gap-2">
                                  <div className="min-w-0">
                                    <div className="text-xs font-medium truncate">{matched.name}</div>
                                    <div className="text-xs text-muted-foreground truncate line-through">{matched.email || '—'}</div>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                      className="text-xs text-primary hover:underline"
                                      onClick={() => setChangingMatchFor(i)}
                                    >
                                      Change
                                    </button>
                                    <span className="text-muted-foreground">·</span>
                                    <button
                                      className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                                      onClick={() => setMatches(prev => ({ ...prev, [i]: null }))}
                                    >
                                      Skip
                                    </button>
                                  </div>
                                </div>
                              ) : category === 'skip' ? (
                                <button
                                  className="text-xs text-primary hover:underline"
                                  onClick={() => {
                                    const auto = autoDetectMatch(row);
                                    if (auto) {
                                      setMatches(prev => ({ ...prev, [i]: auto }));
                                    } else {
                                      setChangingMatchFor(i);
                                    }
                                  }}
                                >
                                  Restore
                                </button>
                              ) : (
                                <button
                                  className="text-xs text-muted-foreground hover:text-primary hover:underline"
                                  onClick={() => setChangingMatchFor(i)}
                                >
                                  Match to existing…
                                </button>
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
              {step === 'map' && <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>}
              {step === 'preview' && <Button variant="outline" onClick={() => setStep('map')}>Back</Button>}
              {step === 'map' && (
                <Button onClick={goToPreview} disabled={mappedContacts.length === 0}>
                  Preview {mappedContacts.length} contact{mappedContacts.length !== 1 ? 's' : ''} <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              {step === 'preview' && (
                <Button onClick={handleUpload} disabled={loading || (toCreate.length === 0 && toUpdate.length === 0)}>
                  {loading ? 'Importing…' : (toCreate.length === 0 && toUpdate.length === 0)
                    ? 'Nothing to import'
                    : [
                        toCreate.length > 0 ? `Create ${toCreate.length}` : '',
                        toUpdate.length > 0 ? `Update ${toUpdate.length}` : '',
                      ].filter(Boolean).join(' · ')}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
