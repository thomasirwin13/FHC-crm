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
import { bulkCreateOrganizationsAction, bulkUpdateOrganizationsAction } from '@/app/app/organizations/actions';
import { toast } from 'sonner';

const APP_FIELDS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'engagement_level', label: 'Engagement level', hint: 'Activist/Attender/Participator/Learner/Potential or 4–0' },
  { key: 'type', label: 'Organization type' },
  { key: 'website', label: 'Website' },
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
    engagement_level: ['engagementlevel', 'level', 'activistlevel', 'engagement'],
    type: ['type', 'orgtype', 'category', 'industry', 'sector'],
    website: ['website', 'url', 'web', 'site'],
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
  id: number;
  name: string;
}

type DuplicateMode = 'skip' | 'update';

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
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>('skip');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingByName = new Map(
    existingOrganizations.map((o) => [o.name.toLowerCase().trim(), o])
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
        setStep('map');
      },
      error: (err) => setError(`Error parsing CSV: ${err.message}`),
    });
  };

  const mappedOrgs = rawRows.map((row) => ({
    name: mapping.name ? row[mapping.name] || '' : '',
    engagement_level: mapping.engagement_level ? row[mapping.engagement_level] || '' : '',
    type: mapping.type ? row[mapping.type] || '' : '',
    website: mapping.website ? row[mapping.website] || '' : '',
    size: mapping.size ? row[mapping.size] || '' : '',
    description: mapping.description ? row[mapping.description] || '' : '',
  })).filter((o) => o.name.trim());

  const isDuplicate = (org: { name: string }) =>
    existingByName.has(org.name.toLowerCase().trim());

  const duplicateCount = mappedOrgs.filter(isDuplicate).length;
  const newOrgs = mappedOrgs.filter((o) => !isDuplicate(o));
  const dupeOrgs = mappedOrgs.filter(isDuplicate);

  const handleUpload = async () => {
    const toCreate = newOrgs;
    const toUpdate = duplicateMode === 'update' ? dupeOrgs : [];

    if (toCreate.length === 0 && toUpdate.length === 0) {
      setError('No organizations to import or update');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const results: string[] = [];

      if (toCreate.length > 0) {
        const createResult = await bulkCreateOrganizationsAction(toCreate);
        if (createResult.error) { setError(createResult.error); setLoading(false); return; }
        results.push(createResult.success || `Created ${toCreate.length}`);
      }

      if (toUpdate.length > 0) {
        const updates = toUpdate.map((o) => ({
          id: existingByName.get(o.name.toLowerCase().trim())!.id,
          ...o,
        }));
        const updateResult = await bulkUpdateOrganizationsAction(updates);
        if (updateResult.error) { setError(updateResult.error); setLoading(false); return; }
        results.push(updateResult.success || `Updated ${toUpdate.length}`);
      }

      toast.success(results.join('. '));
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
            {step === 'preview' && `Preview ${mappedOrgs.length} organization${mappedOrgs.length !== 1 ? 's' : ''} from CSV${duplicateCount > 0 ? ` · ${duplicateCount} already exist` : ''}.`}
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
                <div className="p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-sm space-y-2">
                  <span className="text-yellow-700 dark:text-yellow-400">
                    {duplicateCount} row{duplicateCount !== 1 ? 's' : ''} match existing organizations by name.
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={duplicateMode === 'skip' ? 'default' : 'outline'}
                      onClick={() => setDuplicateMode('skip')}
                      className="text-xs h-7"
                    >
                      Skip duplicates
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={duplicateMode === 'update' ? 'default' : 'outline'}
                      onClick={() => setDuplicateMode('update')}
                      className="text-xs h-7"
                    >
                      Update existing (non-empty fields only)
                    </Button>
                  </div>
                </div>
              )}
              <div className="border border-border rounded-lg overflow-auto max-h-80">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr className="border-b border-border">
                      <th className="text-left p-2 font-medium text-muted-foreground">Name</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Level</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Type</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Website</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedOrgs.map((row, i) => {
                      const dup = isDuplicate(row);
                      const willSkip = dup && duplicateMode === 'skip';
                      const willUpdate = dup && duplicateMode === 'update';
                      return (
                        <tr key={i} className={`border-b border-border last:border-0 ${willSkip ? 'opacity-40' : ''}`}>
                          <td className="p-2">
                            <span>{row.name}</span>
                            {willSkip && (
                              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 font-medium">
                                skip
                              </span>
                            )}
                            {willUpdate && (
                              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-400 font-medium">
                                update
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-muted-foreground capitalize">{row.engagement_level || 'potential'}</td>
                          <td className="p-2 text-muted-foreground">{row.type || '-'}</td>
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
            {step === 'preview' && (() => {
              const createCount = newOrgs.length;
              const updateCount = duplicateMode === 'update' ? dupeOrgs.length : 0;
              const total = createCount + updateCount;
              const label = loading ? 'Importing...' :
                updateCount > 0 && createCount > 0 ? `Create ${createCount} + update ${updateCount}` :
                updateCount > 0 ? `Update ${updateCount} organization${updateCount !== 1 ? 's' : ''}` :
                `Import ${createCount} organization${createCount !== 1 ? 's' : ''}`;
              return (
                <Button onClick={handleUpload} disabled={loading || total === 0}>
                  {label}
                </Button>
              );
            })()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
