'use client';

import { useState, useRef } from 'react';
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
import { Upload, FileText, X, ArrowRight } from 'lucide-react';
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
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingEmails = new Set(existingContacts.map((c) => c.email?.toLowerCase().trim()).filter(Boolean));
  const existingNames = new Set(existingContacts.map((c) => c.name.toLowerCase().trim()));

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

  const duplicateCount = mappedContacts.filter(isDuplicate).length;
  const contactsToImport = skipDuplicates ? mappedContacts.filter(c => !isDuplicate(c)) : mappedContacts;

  const handleUpload = async () => {
    if (contactsToImport.length === 0) { setError('No contacts to import after filtering duplicates'); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await bulkCreateContactsAction(contactsToImport);
      if (result.error) {
        setError(result.error);
      } else {
        toast.success(result.success || 'Contacts imported');
        handleClose();
        window.location.reload();
      }
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
            {step === 'preview' && `Preview ${contactsToImport.length} contact${contactsToImport.length !== 1 ? 's' : ''} to import${duplicateCount > 0 ? ` · ${duplicateCount} duplicate${duplicateCount !== 1 ? 's' : ''} detected` : ''}.`}
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
                    {duplicateCount} row{duplicateCount !== 1 ? 's' : ''} match existing contacts by name or email.
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-xs font-medium">Skip duplicates</span>
                  </label>
                </div>
              )}
              <div className="border border-border rounded-lg overflow-auto max-h-80">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr className="border-b border-border">
                      <th className="text-left p-2 font-medium text-muted-foreground">Name</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Email</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Level</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Committed</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Categories</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedContacts.map((row, i) => {
                      const dup = isDuplicate(row);
                      const skip = dup && skipDuplicates;
                      return (
                        <tr key={i} className={`border-b border-border last:border-0 ${skip ? 'opacity-40' : ''}`}>
                          <td className="p-2">
                            <span>{row.name}</span>
                            {dup && (
                              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 font-medium">
                                duplicate
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-muted-foreground">{row.email || '-'}</td>
                          <td className="p-2 text-muted-foreground capitalize">{row.engagement_level || 'potential'}</td>
                          <td className="p-2 text-muted-foreground">{row.action_committed || '-'}</td>
                          <td className="p-2 text-muted-foreground">{row.categories || '-'}</td>
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
              <Button onClick={handleUpload} disabled={loading || contactsToImport.length === 0}>
                {loading ? 'Importing...' : `Import ${contactsToImport.length} contact${contactsToImport.length !== 1 ? 's' : ''}`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
