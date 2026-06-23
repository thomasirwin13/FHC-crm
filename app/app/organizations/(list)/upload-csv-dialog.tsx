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
import { Upload, FileText, ArrowRight } from 'lucide-react';
import Papa from 'papaparse';
import { bulkCreateOrganizationsAction } from '@/app/app/organizations/actions';
import { toast } from 'sonner';

const APP_FIELDS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'engagement_level', label: 'Engagement level', hint: 'Activist/Attender/Participator/Learner/Potential or 4–0' },
  { key: 'industry', label: 'Industry' },
  { key: 'website', label: 'Website' },
  { key: 'location', label: 'Location' },
  { key: 'size', label: 'Size' },
  { key: 'description', label: 'Description' },
] as const;

type AppFieldKey = typeof APP_FIELDS[number]['key'];
type ColumnMapping = Record<AppFieldKey, string>;

function guessMapping(csvColumns: string[]): ColumnMapping {
  const mapping: Partial<ColumnMapping> = {};
  const lower = (s: string) => s.toLowerCase().replace(/[\s_-]/g, '');

  const matchers: Record<AppFieldKey, string[]> = {
    name: ['name', 'orgname', 'organizationname', 'company', 'companyname'],
    engagement_level: ['engagementlevel', 'level', 'activistlevel', 'engagement', 'type', 'orgtype', 'category'],
    industry: ['industry', 'sector'],
    website: ['website', 'url', 'web', 'site'],
    location: ['location', 'address', 'city', 'place'],
    size: ['size', 'orgsize', 'employees', 'headcount'],
    description: ['description', 'notes', 'about', 'details'],
  };

  for (const field of APP_FIELDS) {
    const candidates = matchers[field.key];
    const match = csvColumns.find((col) => candidates.includes(lower(col)));
    mapping[field.key] = match || '';
  }

  return mapping as ColumnMapping;
}

interface ExistingOrg {
  name: string;
}

interface UploadOrganizationsCsvDialogProps {
  existingOrganizations?: ExistingOrg[];
}

export default function UploadOrganizationsCsvDialog({
  existingOrganizations = [],
}: UploadOrganizationsCsvDialogProps) {
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

  const existingNames = new Set(existingOrganizations.map((o) => o.name.toLowerCase().trim()));

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

  const mappedOrgs = rawRows.map((row) => ({
    name: mapping.name ? row[mapping.name] || '' : '',
    engagement_level: mapping.engagement_level ? row[mapping.engagement_level] || '' : '',
    industry: mapping.industry ? row[mapping.industry] || '' : '',
    website: mapping.website ? row[mapping.website] || '' : '',
    location: mapping.location ? row[mapping.location] || '' : '',
    size: mapping.size ? row[mapping.size] || '' : '',
    description: mapping.description ? row[mapping.description] || '' : '',
  })).filter((o) => o.name.trim());

  const isDuplicate = (org: { name: string }) =>
    existingNames.has(org.name.toLowerCase().trim());

  const duplicateCount = mappedOrgs.filter(isDuplicate).length;
  const orgsToImport = skipDuplicates ? mappedOrgs.filter((o) => !isDuplicate(o)) : mappedOrgs;

  const handleUpload = async () => {
    if (orgsToImport.length === 0) { setError('No organizations to import after filtering duplicates'); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await bulkCreateOrganizationsAction(orgsToImport);
      if (result.error) {
        setError(result.error);
      } else {
        toast.success(result.success || 'Organizations imported');
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
          <DialogTitle>Import organizations from CSV</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Select a CSV file to get started.'}
            {step === 'map' && 'Match your CSV columns to the correct organization fields.'}
            {step === 'preview' && `Preview ${orgsToImport.length} organization${orgsToImport.length !== 1 ? 's' : ''} to import${duplicateCount > 0 ? ` · ${duplicateCount} duplicate${duplicateCount !== 1 ? 's' : ''} detected` : ''}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="border-2 border-dashed border-border rounded-lg p-10 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">Select a CSV file to upload</p>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" id="orgs-csv-upload" />
              <label htmlFor="orgs-csv-upload">
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
                      <th className="text-left p-3 font-medium text-muted-foreground w-2/5">Organization field</th>
                      <th className="text-left p-3 font-medium text-muted-foreground w-3/5">CSV column</th>
                    </tr>
                  </thead>
                  <tbody>
                    {APP_FIELDS.map((field) => (
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
                            onValueChange={(val) => setMapping((prev) => ({ ...prev, [field.key]: val === '__none__' ? '' : val }))}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="— skip —" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— skip —</SelectItem>
                              {csvColumns.map((col) => (
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
                    {duplicateCount} row{duplicateCount !== 1 ? 's' : ''} match existing organizations by name.
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
                      <th className="text-left p-2 font-medium text-muted-foreground">Level</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Industry</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Location</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Website</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedOrgs.map((row, i) => {
                      const dup = isDuplicate(row);
                      return (
                        <tr key={i} className={`border-b border-border last:border-0 ${dup && skipDuplicates ? 'opacity-40' : ''}`}>
                          <td className="p-2">
                            <span>{row.name}</span>
                            {dup && (
                              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 font-medium">
                                duplicate
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-muted-foreground capitalize">{row.engagement_level || 'potential'}</td>
                          <td className="p-2 text-muted-foreground">{row.industry || '-'}</td>
                          <td className="p-2 text-muted-foreground">{row.location || '-'}</td>
                          <td className="p-2 text-muted-foreground">{row.website || '-'}</td>
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
              <Button
                onClick={() => {
                  if (!mapping.name) { setError('Please map the Name field — it is required'); return; }
                  setError(null);
                  setStep('preview');
                }}
                disabled={mappedOrgs.length === 0}
              >
                Preview {mappedOrgs.length} organization{mappedOrgs.length !== 1 ? 's' : ''} <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 'preview' && (
              <Button onClick={handleUpload} disabled={loading || orgsToImport.length === 0}>
                {loading ? 'Importing...' : `Import ${orgsToImport.length} organization${orgsToImport.length !== 1 ? 's' : ''}`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
