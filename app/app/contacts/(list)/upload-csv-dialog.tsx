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
import { Upload, FileText, ArrowRight, Search } from 'lucide-react';
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

export default function UploadContactsCsvDialog({ existingContacts = [] }: UploadContactsCsvDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({} as ColumnMapping);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // row index → ExistingContact (manual override) | null (explicitly skipped) | undefined (use auto)
  const [overrides, setOverrides] = useState<Record<number, ExistingContact | null>>({});
  // which row's inline contact picker is open
  const [pickerRow, setPickerRow] = useState<number | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
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

  const autoDetect = (row: { name: string; email: string }): ExistingContact | null => {
    if (row.email) {
      const byEmail = existingByEmail[row.email.toLowerCase().trim()];
      if (byEmail) return byEmail;
    }
    return existingByName[row.name.toLowerCase().trim()] ?? null;
  };

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
        setOverrides({});
        setPickerRow(null);
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

  // Determine what will happen to each row:
  // 'new'    → create new contact
  // 'update' → update existing contact's email
  // 'skip'   → user explicitly chose not to update a matched contact
  const getRowState = (row: { name: string; email: string }, i: number): {
    action: 'new' | 'update' | 'skip';
    match: ExistingContact | null;
  } => {
    if (i in overrides) {
      const explicit = overrides[i];
      if (explicit === null) {
        // User explicitly skipped — still show as skip (don't create a duplicate)
        return { action: 'skip', match: null };
      }
      return { action: 'update', match: explicit };
    }
    const auto = autoDetect(row);
    if (auto) return { action: 'update', match: auto };
    return { action: 'new', match: null };
  };

  const rowStates = mappedContacts.map((row, i) => getRowState(row, i));
  const toCreate = mappedContacts.filter((_, i) => rowStates[i].action === 'new');
  const toUpdate = mappedContacts
    .map((row, i) => ({ row, match: rowStates[i].match }))
    .filter((_, i) => rowStates[i].action === 'update') as { row: typeof mappedContacts[0]; match: ExistingContact }[];

  const totalNew = toCreate.length;
  const totalUpdate = toUpdate.length;
  const totalSkip = rowStates.filter(s => s.action === 'skip').length;

  const pickerFiltered = useMemo(() => {
    if (pickerRow === null) return [];
    const q = pickerQuery.toLowerCase().trim();
    if (!q) return existingContacts.slice(0, 60);
    return existingContacts.filter(c =>
      c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
    ).slice(0, 60);
  }, [existingContacts, pickerRow, pickerQuery]);

  const goToPreview = () => {
    if (!mapping.name) { setError('Please map the Name field — it is required'); return; }
    setError(null);
    setOverrides({});
    setPickerRow(null);
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
        const updates = toUpdate.map(({ row, match }) => ({
          contactId: match.id,
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
    setOverrides({});
    setPickerRow(null);
    setPickerQuery('');
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
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import contacts from CSV</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Select a CSV file to get started.'}
            {step === 'map' && 'Match your CSV columns to the correct contact fields.'}
            {step === 'preview' && [
              totalNew > 0 ? `${totalNew} new` : '',
              totalUpdate > 0 ? `${totalUpdate} email update${totalUpdate !== 1 ? 's' : ''}` : '',
              totalSkip > 0 ? `${totalSkip} skipped` : '',
            ].filter(Boolean).join(' · ')}
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
              {totalUpdate > 0 && (
                <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/20 text-sm text-blue-700 dark:text-blue-400">
                  <strong>{totalUpdate} row{totalUpdate !== 1 ? 's' : ''}</strong> matched existing contacts by name or email — their email addresses will be updated. You can change or skip any match below.
                </div>
              )}

              <div className="border border-border rounded-lg overflow-auto max-h-[50vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted z-10">
                    <tr className="border-b border-border">
                      <th className="text-left p-2 font-medium text-muted-foreground">Name</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Email (from CSV)</th>
                      <th className="text-left p-2 font-medium text-muted-foreground w-24">Action</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Matched to existing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedContacts.map((row, i) => {
                      const { action, match } = rowStates[i];
                      const isPickerOpen = pickerRow === i;

                      return (
                        <tr key={i} className={`border-b border-border last:border-0 align-top ${action === 'skip' ? 'opacity-40' : ''}`}>
                          <td className="p-2 font-medium">{row.name}</td>
                          <td className="p-2 text-muted-foreground text-xs">{row.email || '—'}</td>
                          <td className="p-2">
                            {action === 'new' && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/15 text-green-700 dark:text-green-400 font-medium">new</span>
                            )}
                            {action === 'update' && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-400 font-medium">update email</span>
                            )}
                            {action === 'skip' && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">skip</span>
                            )}
                          </td>
                          <td className="p-2">
                            {action === 'update' && match ? (
                              <div>
                                <div className="flex items-center gap-2">
                                  <div className="min-w-0">
                                    <div className="text-xs font-medium">{match.name}</div>
                                    {match.email && <div className="text-xs text-muted-foreground line-through">{match.email}</div>}
                                  </div>
                                  <div className="flex gap-1 flex-shrink-0 text-xs">
                                    <button className="text-primary hover:underline" onClick={() => { setPickerRow(isPickerOpen ? null : i); setPickerQuery(''); }}>Change</button>
                                    <span className="text-muted-foreground">·</span>
                                    <button className="text-muted-foreground hover:text-foreground hover:underline" onClick={() => { setOverrides(p => ({ ...p, [i]: null })); setPickerRow(null); }}>Skip</button>
                                  </div>
                                </div>
                                {/* Inline contact picker */}
                                {isPickerOpen && (
                                  <div className="mt-2 border border-border rounded-lg bg-background shadow-md p-2 space-y-1.5 z-20 relative">
                                    <div className="relative">
                                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                      <Input
                                        value={pickerQuery}
                                        onChange={e => setPickerQuery(e.target.value)}
                                        placeholder="Search contacts…"
                                        className="h-7 pl-7 text-xs"
                                        autoFocus
                                      />
                                    </div>
                                    <div className="max-h-40 overflow-y-auto divide-y divide-border/30">
                                      {pickerFiltered.length === 0 ? (
                                        <p className="text-xs text-muted-foreground py-2 text-center">No contacts found</p>
                                      ) : pickerFiltered.map(c => (
                                        <button
                                          key={c.id}
                                          className="w-full text-left px-2 py-1.5 hover:bg-muted/60 transition-colors"
                                          onClick={() => { setOverrides(p => ({ ...p, [i]: c })); setPickerRow(null); setPickerQuery(''); }}
                                        >
                                          <div className="text-xs font-medium">{c.name}</div>
                                          {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : action === 'skip' ? (
                              <button
                                className="text-xs text-primary hover:underline"
                                onClick={() => {
                                  const auto = autoDetect(row);
                                  if (auto) setOverrides(p => ({ ...p, [i]: auto }));
                                  else { setOverrides(p => { const n = { ...p }; delete n[i]; return n; }); }
                                }}
                              >
                                Restore
                              </button>
                            ) : (
                              <button
                                className="text-xs text-muted-foreground hover:text-primary hover:underline"
                                onClick={() => { setPickerRow(isPickerOpen ? null : i); setPickerQuery(''); }}
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
              {error && <p className="text-sm text-destructive">{error}</p>}
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
  );
}
