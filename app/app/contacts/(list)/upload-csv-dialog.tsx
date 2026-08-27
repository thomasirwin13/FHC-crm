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
import { Upload, FileText, ArrowRight, Search, RefreshCw } from 'lucide-react';
import Papa from 'papaparse';
import { bulkCreateContactsAction } from '@/app/app/organizations/[id]/contact-actions';
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
  { key: 'regions', label: 'Region', hint: 'Comma-separated, e.g. "South LA, West LA"' },
  { key: 'categories', label: 'Categories', hint: 'Comma-separated names, e.g. "Newsletter, WhatsApp"' },
] as const;

/** In update mode only Name + address fields are relevant */
const UPDATE_FIELDS = APP_FIELDS.filter(f =>
  ['name', 'email', 'street', 'city', 'state', 'zip'].includes(f.key)
);

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
    regions: ['regions', 'region'],
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
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

type Mode = 'import' | 'update';

interface UploadContactsCsvDialogProps {
  existingContacts?: ExistingContact[];
}

export default function UploadContactsCsvDialog({ existingContacts = [] }: UploadContactsCsvDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('import');
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({} as ColumnMapping);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  // match override: row index → contact id (null = skip)
  const [matchOverride, setMatchOverride] = useState<Record<number, { id: number; name: string } | null>>({});
  const [pickerOpen, setPickerOpen] = useState<number | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  // update mode: row index → excluded from update
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingEmails = new Set(
    existingContacts.map(c => c.email?.toLowerCase().trim()).filter((e): e is string => !!e)
  );
  const existingNames = new Set(
    existingContacts.map(c => (c.name || '').toLowerCase().trim()).filter(Boolean)
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    if (!selectedFile.name.endsWith('.csv')) { setError('Please select a CSV file'); return; }
    setFile(selectedFile);
    setError(null);
    try {
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const cols = ((results.meta.fields || []) as string[]).filter(c => c.trim() !== '');
            const rows = results.data as Record<string, string>[];
            setCsvColumns(cols);
            setRawRows(rows);
            setMapping(guessMapping(cols));
            setMatchOverride({});
            setExcludedRows(new Set());
            setPickerOpen(null);
            setStep('map');
          } catch (err) {
            setError('Error processing CSV columns');
            console.error(err);
          }
        },
        error: (err) => setError(`Error parsing CSV: ${err.message}`),
      });
    } catch (err) {
      setError('Error reading file');
      console.error(err);
    }
  };

  const mappedContacts = rawRows.map(row => ({
    name: (mapping.name ? row[mapping.name] : '') || '',
    email: (mapping.email ? row[mapping.email] : '') || '',
    phone: (mapping.phone ? row[mapping.phone] : '') || '',
    street: (mapping.street ? row[mapping.street] : '') || '',
    city: (mapping.city ? row[mapping.city] : '') || '',
    state: (mapping.state ? row[mapping.state] : '') || '',
    zip: (mapping.zip ? row[mapping.zip] : '') || '',
    engagement_level: (mapping.engagement_level ? row[mapping.engagement_level] : '') || '',
    action_committed: (mapping.action_committed ? row[mapping.action_committed] : '') || '',
    preferred_contact_method: (mapping.preferred_contact_method ? row[mapping.preferred_contact_method] : '') || '',
    categories: (mapping.categories ? row[mapping.categories] : '') || '',
  })).filter(c => c.name.trim());

  const isDuplicate = (contact: { name: string; email: string }) => {
    if (contact.email && existingEmails.has(contact.email.toLowerCase().trim())) return true;
    if (existingNames.has(contact.name.toLowerCase().trim())) return true;
    return false;
  };

  // --- Update mode: auto-match CSV rows to existing contacts ---
  const autoMatches = useMemo(() => {
    if (mode !== 'update') return [];
    return mappedContacts.map((row) => {
      // Try email match first (most reliable)
      if (row.email) {
        const emailLower = row.email.toLowerCase().trim();
        const byEmail = existingContacts.find(c => c.email?.toLowerCase().trim() === emailLower);
        if (byEmail) return byEmail;
      }
      // Fall back to name match
      const nameLower = row.name.toLowerCase().trim();
      const byName = existingContacts.find(c => (c.name || '').toLowerCase().trim() === nameLower);
      return byName || null;
    });
  }, [mode, mappedContacts, existingContacts]);

  const updateRows = useMemo(() => {
    if (mode !== 'update') return [];
    return mappedContacts.map((row, i) => {
      const match = autoMatches[i];
      if (!match) return null;
      const hasStreet = row.street && row.street !== (match.street || '');
      const hasCity = row.city && row.city !== (match.city || '');
      const hasState = row.state && row.state !== (match.state || '');
      const hasZip = row.zip && row.zip !== (match.zip || '');
      const hasChange = hasStreet || hasCity || hasState || hasZip;
      return { row, match, hasChange, index: i };
    }).filter(Boolean) as { row: typeof mappedContacts[number]; match: ExistingContact; hasChange: boolean; index: number }[];
  }, [mode, mappedContacts, autoMatches]);

  const matchedUpdateCount = updateRows.length;
  const changedUpdateCount = updateRows.filter(r => r.hasChange && !excludedRows.has(r.index)).length;
  const unmatchedCount = mode === 'update' ? mappedContacts.length - matchedUpdateCount : 0;

  const pickerContacts = pickerQuery.trim()
    ? existingContacts.filter(c =>
        (c.name || '').toLowerCase().includes(pickerQuery.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(pickerQuery.toLowerCase())
      ).slice(0, 60)
    : existingContacts.slice(0, 60);

  const duplicateCount = mappedContacts.filter(isDuplicate).length;
  const contactsToImport = skipDuplicates
    ? mappedContacts.filter((c, i) => !isDuplicate(c) || i in matchOverride)
    : mappedContacts;

  const handleUpload = async () => {
    if (mode === 'update') {
      await handleUpdateAddresses();
      return;
    }

    const toCreate = contactsToImport.filter((_, i) => !(i in matchOverride));
    if (toCreate.length === 0 && Object.keys(matchOverride).length === 0) {
      setError('No contacts to import');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (toCreate.length > 0) {
        const result = await bulkCreateContactsAction(toCreate);
        if (result.error) { setError(result.error); setLoading(false); return; }
      }
      // Update emails for matched contacts
      const updates = Object.entries(matchOverride)
        .filter(([, v]) => v !== null)
        .map(([idxStr, contact]) => ({ contact: contact!, row: mappedContacts[Number(idxStr)] }))
        .filter(({ row }) => row?.email);

      if (updates.length > 0) {
        const { updateContactsFromCsvAction } = await import('@/app/app/organizations/[id]/contact-actions');
        const result = await updateContactsFromCsvAction(
          updates.map(({ contact, row }) => ({ contactId: contact.id, email: row.email }))
        );
        if (result.error) { setError(result.error); setLoading(false); return; }
      }

      const created = toCreate.length;
      const updated = updates.length;
      toast.success([
        created > 0 ? `${created} contact${created !== 1 ? 's' : ''} imported` : '',
        updated > 0 ? `${updated} email${updated !== 1 ? 's' : ''} updated` : '',
      ].filter(Boolean).join(' · '));
      handleClose();
      window.location.reload();
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAddresses = async () => {
    const toUpdate = updateRows.filter(r => r.hasChange && !excludedRows.has(r.index));
    if (toUpdate.length === 0) {
      setError('No address changes to apply');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { bulkUpdateContactAddressesAction } = await import('@/app/app/organizations/[id]/contact-actions');
      const result = await bulkUpdateContactAddressesAction(
        toUpdate.map(({ match, row }) => ({
          contactId: match.id,
          street: row.street,
          city: row.city,
          state: row.state,
          zip: row.zip,
        }))
      );
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      toast.success(`${result.updated} address${result.updated !== 1 ? 'es' : ''} updated`);
      handleClose();
      window.location.reload();
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setMode('import');
    setStep('upload');
    setFile(null);
    setCsvColumns([]);
    setRawRows([]);
    setMapping({} as ColumnMapping);
    setMatchOverride({});
    setExcludedRows(new Set());
    setPickerOpen(null);
    setPickerQuery('');
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fieldsToShow = mode === 'update' ? UPDATE_FIELDS : APP_FIELDS;

  const dialogTitle = mode === 'update' ? 'Update addresses from CSV' : 'Import contacts from CSV';
  const dialogDesc = (() => {
    if (step === 'upload') return mode === 'update'
      ? 'Upload a CSV with names and addresses to update existing contacts.'
      : 'Select a CSV file to get started.';
    if (step === 'map') return 'Match your CSV columns to the correct contact fields.';
    if (step === 'preview' && mode === 'update') {
      if (matchedUpdateCount === 0) return 'No matching contacts found in the CSV.';
      return `${changedUpdateCount} address${changedUpdateCount !== 1 ? 'es' : ''} to update · ${matchedUpdateCount} matched · ${unmatchedCount} unmatched`;
    }
    return `Preview ${mappedContacts.length} contact${mappedContacts.length !== 1 ? 's' : ''}${duplicateCount > 0 ? ` · ${duplicateCount} duplicate${duplicateCount !== 1 ? 's' : ''} detected` : ''}.`;
  })();

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
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDesc}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Mode toggle */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode('import')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    mode === 'import'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-foreground/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Upload className="h-4 w-4" />
                    <span className="font-medium text-sm">Import new contacts</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Create new contacts from a CSV file</p>
                </button>
                <button
                  onClick={() => setMode('update')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    mode === 'update'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-foreground/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <RefreshCw className="h-4 w-4" />
                    <span className="font-medium text-sm">Update addresses</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Update addresses for existing contacts</p>
                </button>
              </div>

              <div className="border-2 border-dashed border-border rounded-lg p-10 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">
                  {mode === 'update'
                    ? 'Upload a CSV with names (or emails) and addresses'
                    : 'Select a CSV file to upload'}
                </p>
                <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" id="contacts-csv-upload" />
                <label htmlFor="contacts-csv-upload">
                  <Button asChild variant="outline"><span>Choose file</span></Button>
                </label>
                {error && <p className="text-sm text-destructive mt-3">{error}</p>}
              </div>
            </div>
          )}

          {/* Step 2: Column mapping */}
          {step === 'map' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted rounded-md">
                <FileText className="h-4 w-4 flex-shrink-0" />
                <span>{file?.name} — {rawRows.length} rows, {csvColumns.length} columns detected</span>
                {mode === 'update' && (
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                    Update mode
                  </span>
                )}
              </div>
              {mode === 'update' && (
                <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/20 text-sm text-blue-700 dark:text-blue-400">
                  Map your <strong>Name</strong> (or <strong>Email</strong>) column to match existing contacts, plus the address fields you want to update. Only address fields will be changed — no other data is touched.
                </div>
              )}
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr className="border-b border-border">
                      <th className="text-left p-3 font-medium text-muted-foreground w-2/5">Contact field</th>
                      <th className="text-left p-3 font-medium text-muted-foreground w-3/5">CSV column</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fieldsToShow.map(field => (
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

          {/* Step 3: Preview — Update mode */}
          {step === 'preview' && mode === 'update' && (
            <div className="space-y-3">
              {unmatchedCount > 0 && (
                <div className="p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-sm">
                  <span className="text-yellow-700 dark:text-yellow-400">
                    {unmatchedCount} row{unmatchedCount !== 1 ? 's' : ''} could not be matched to existing contacts and will be skipped.
                  </span>
                </div>
              )}
              {updateRows.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <p className="font-medium mb-1">No matches found</p>
                  <p className="text-sm">None of the CSV rows matched existing contacts by name or email. Check your column mapping and try again.</p>
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-auto max-h-[50vh]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted z-10">
                      <tr className="border-b border-border">
                        <th className="text-left p-2 font-medium text-muted-foreground w-8">
                          <input
                            type="checkbox"
                            checked={excludedRows.size === 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setExcludedRows(new Set());
                              } else {
                                setExcludedRows(new Set(updateRows.filter(r => r.hasChange).map(r => r.index)));
                              }
                            }}
                            className="rounded"
                          />
                        </th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Contact</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Current address</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">New address</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {updateRows.map(({ row, match, hasChange, index }) => {
                        const excluded = excludedRows.has(index);
                        const currentAddr = [match.street, match.city, match.state, match.zip].filter(Boolean).join(', ');
                        const newAddr = [row.street, row.city, row.state, row.zip].filter(Boolean).join(', ');

                        return (
                          <tr
                            key={index}
                            className={`border-b border-border last:border-0 align-top ${excluded ? 'opacity-40' : ''}`}
                          >
                            <td className="p-2">
                              {hasChange && (
                                <input
                                  type="checkbox"
                                  checked={!excluded}
                                  onChange={() => {
                                    setExcludedRows(prev => {
                                      const next = new Set(prev);
                                      if (next.has(index)) next.delete(index);
                                      else next.add(index);
                                      return next;
                                    });
                                  }}
                                  className="rounded"
                                />
                              )}
                            </td>
                            <td className="p-2">
                              <div className="font-medium">{match.name}</div>
                              {match.email && <div className="text-xs text-muted-foreground">{match.email}</div>}
                            </td>
                            <td className="p-2 text-xs text-muted-foreground">
                              {currentAddr || <span className="italic">No address</span>}
                            </td>
                            <td className="p-2 text-xs">
                              {hasChange ? (
                                <span className="text-foreground">{newAddr}</span>
                              ) : (
                                <span className="text-muted-foreground">{newAddr || '—'}</span>
                              )}
                            </td>
                            <td className="p-2">
                              {hasChange ? (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-400 font-medium">
                                  will update
                                </span>
                              ) : (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-500/10 text-muted-foreground font-medium">
                                  no change
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}

          {/* Step 3: Preview — Import mode */}
          {step === 'preview' && mode === 'import' && (
            <div className="space-y-3">
              {duplicateCount > 0 && (
                <div className="p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-yellow-700 dark:text-yellow-400">
                      {duplicateCount} row{duplicateCount !== 1 ? 's' : ''} match existing contacts. Use <strong>Match</strong> to update their email instead of skipping.
                    </span>
                    <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                      <input type="checkbox" checked={skipDuplicates} onChange={e => setSkipDuplicates(e.target.checked)} className="rounded" />
                      <span className="text-xs font-medium">Skip unmatched duplicates</span>
                    </label>
                  </div>
                </div>
              )}
              <div className="border border-border rounded-lg overflow-auto max-h-[50vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted z-10">
                    <tr className="border-b border-border">
                      <th className="text-left p-2 font-medium text-muted-foreground">Name</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Email</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Level</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Status / match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedContacts.map((row, i) => {
                      const dup = isDuplicate(row);
                      const override = matchOverride[i];
                      const isMatched = i in matchOverride && override !== null;
                      const isSkipped = dup && skipDuplicates && !(i in matchOverride);
                      const isPicker = pickerOpen === i;

                      return (
                        <tr key={i} className={`border-b border-border last:border-0 align-top ${isSkipped ? 'opacity-40' : ''}`}>
                          <td className="p-2 font-medium">{row.name}</td>
                          <td className="p-2 text-muted-foreground text-xs">{row.email || '—'}</td>
                          <td className="p-2 text-muted-foreground text-xs capitalize">{row.engagement_level || 'potential'}</td>
                          <td className="p-2">
                            {isMatched ? (
                              <div>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-400 font-medium">update email → {override!.name}</span>
                                <div className="flex gap-2 mt-1">
                                  <button onClick={() => { setPickerOpen(isPicker ? null : i); setPickerQuery(''); }} className="text-xs text-primary hover:underline">Change</button>
                                  <button onClick={() => { setMatchOverride(p => { const n = { ...p }; delete n[i]; return n; }); }} className="text-xs text-muted-foreground hover:underline">Remove</button>
                                </div>
                              </div>
                            ) : dup ? (
                              <div>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 font-medium">duplicate</span>
                                <div className="mt-1">
                                  <button onClick={() => { setPickerOpen(isPicker ? null : i); setPickerQuery(''); }} className="text-xs text-primary hover:underline">Match &amp; update email</button>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/15 text-green-700 dark:text-green-400 font-medium">new</span>
                            )}

                            {/* Inline picker */}
                            {isPicker && (
                              <div className="mt-2 border border-border rounded-lg bg-background shadow-sm p-2 space-y-1.5">
                                <div className="relative">
                                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                                  <Input
                                    value={pickerQuery}
                                    onChange={e => setPickerQuery(e.target.value)}
                                    placeholder="Search contacts…"
                                    className="h-7 pl-7 text-xs"
                                    autoFocus
                                  />
                                </div>
                                <div className="max-h-36 overflow-y-auto divide-y divide-border/30">
                                  {pickerContacts.length === 0
                                    ? <p className="text-xs text-muted-foreground py-2 text-center">No contacts found</p>
                                    : pickerContacts.map(c => (
                                        <button
                                          key={c.id}
                                          className="w-full text-left px-2 py-1.5 hover:bg-muted/60 text-xs"
                                          onClick={() => {
                                            setMatchOverride(p => ({ ...p, [i]: { id: c.id, name: c.name } }));
                                            setPickerOpen(null);
                                            setPickerQuery('');
                                          }}
                                        >
                                          <div className="font-medium">{c.name}</div>
                                          {c.email && <div className="text-muted-foreground">{c.email}</div>}
                                        </button>
                                      ))
                                  }
                                </div>
                                <Button size="sm" variant="ghost" className="w-full h-6 text-xs" onClick={() => setPickerOpen(null)}>Cancel</Button>
                              </div>
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
              <Button
                onClick={() => {
                  if (mode === 'update') {
                    if (!mapping.name && !mapping.email) {
                      setError('Please map the Name or Email field to match contacts');
                      return;
                    }
                    if (!mapping.street && !mapping.city && !mapping.state && !mapping.zip) {
                      setError('Please map at least one address field (Street, City, State, or Zip)');
                      return;
                    }
                  } else {
                    if (!mapping.name) { setError('Please map the Name field — it is required'); return; }
                  }
                  setError(null);
                  setMatchOverride({});
                  setExcludedRows(new Set());
                  setStep('preview');
                }}
                disabled={mappedContacts.length === 0}
              >
                Preview {mappedContacts.length} contact{mappedContacts.length !== 1 ? 's' : ''} <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 'preview' && mode === 'import' && (
              <Button onClick={handleUpload} disabled={loading || contactsToImport.length === 0}>
                {loading ? 'Importing…' : `Import ${contactsToImport.length} contact${contactsToImport.length !== 1 ? 's' : ''}`}
              </Button>
            )}
            {step === 'preview' && mode === 'update' && (
              <Button onClick={handleUpload} disabled={loading || changedUpdateCount === 0}>
                {loading ? 'Updating…' : `Update ${changedUpdateCount} address${changedUpdateCount !== 1 ? 'es' : ''}`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
