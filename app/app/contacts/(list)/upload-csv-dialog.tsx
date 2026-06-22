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
import { Upload, FileText, X } from 'lucide-react';
import Papa from 'papaparse';
import { bulkCreateContactsAction } from '@/app/app/organizations/[id]/contact-actions';
import { toast } from 'sonner';

interface ParsedContact {
  name: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export default function UploadContactsCsvDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    setFile(selectedFile);
    setError(null);
    parseCSV(selectedFile);
  };

  const parseCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const contacts = results.data.map((row: any) => ({
          name: row['Name'] || row['name'] || row['Full Name'] || row['full_name'] || '',
          email: row['Email'] || row['email'] || row['Email Address'] || '',
          phone: row['Phone'] || row['phone'] || row['Phone Number'] || row['phone_number'] || '',
          street: row['Street'] || row['street'] || row['Address'] || row['address'] || '',
          city: row['City'] || row['city'] || '',
          state: row['State'] || row['state'] || '',
          zip: row['Zip'] || row['zip'] || row['ZIP'] || row['Postal Code'] || row['postal_code'] || '',
        }));
        const valid = contacts.filter((c) => c.name.trim());
        if (valid.length === 0) {
          setError('No valid contacts found. Make sure your CSV has a "Name" column.');
        }
        setParsedData(valid);
      },
      error: (err) => {
        setError(`Error parsing CSV: ${err.message}`);
        setParsedData([]);
      },
    });
  };

  const handleUpload = async () => {
    if (parsedData.length === 0) {
      setError('No data to upload');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await bulkCreateContactsAction(parsedData);
      if (result.error) {
        setError(result.error);
      } else {
        toast.success(result.success || 'Contacts imported');
        setOpen(false);
        reset();
        window.location.reload();
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setParsedData([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveRow = (index: number) => {
    setParsedData((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex-shrink-0 border-border hover:bg-accent hover:border-foreground/20 transition-all duration-150">
          <Upload className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Import CSV</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import contacts from CSV</DialogTitle>
          <DialogDescription>
            CSV should include columns: Name, Email, Phone, Street, City, State, Zip
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {!file ? (
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">Select a CSV file to upload</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="contacts-csv-upload"
              />
              <label htmlFor="contacts-csv-upload">
                <Button asChild variant="outline">
                  <span>Choose file</span>
                </Button>
              </label>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-3 bg-muted border border-border rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{file.name}</span>
                  <span className="text-sm text-muted-foreground">({parsedData.length} contacts)</span>
                </div>
                <Button size="sm" variant="ghost" onClick={reset}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
                  {error}
                </div>
              )}

              {parsedData.length > 0 && (
                <div className="border border-border rounded-lg max-h-96 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted">
                      <tr className="border-b border-border">
                        <th className="text-left p-2 text-muted-foreground font-medium">Name</th>
                        <th className="text-left p-2 text-muted-foreground font-medium">Email</th>
                        <th className="text-left p-2 text-muted-foreground font-medium">Phone</th>
                        <th className="text-left p-2 text-muted-foreground font-medium">City</th>
                        <th className="text-left p-2 text-muted-foreground font-medium">State</th>
                        <th className="p-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.map((row, index) => (
                        <tr key={index} className="border-b border-border last:border-0">
                          <td className="p-2">{row.name}</td>
                          <td className="p-2 text-muted-foreground">{row.email || '-'}</td>
                          <td className="p-2 text-muted-foreground">{row.phone || '-'}</td>
                          <td className="p-2 text-muted-foreground">{row.city || '-'}</td>
                          <td className="p-2 text-muted-foreground">{row.state || '-'}</td>
                          <td className="p-2">
                            <Button size="sm" variant="ghost" onClick={() => handleRemoveRow(index)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          {file && parsedData.length > 0 && (
            <Button onClick={handleUpload} disabled={loading}>
              {loading ? 'Importing...' : `Import ${parsedData.length} contacts`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
