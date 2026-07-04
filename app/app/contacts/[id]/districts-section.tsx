'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Landmark, Loader2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { lookupContactDistrictsAction } from './district-actions';
import { toast } from 'sonner';

interface Districts {
  congressional_district: string | null;
  state_senate_district: string | null;
  state_assembly_district: string | null;
  county: string | null;
  districts_updated_at: string | null;
}

interface DistrictsSectionProps {
  contactId: number;
  initial: Districts;
  hasAddress: boolean;
}

export default function DistrictsSection({ contactId, initial, hasAddress }: DistrictsSectionProps) {
  const [districts, setDistricts] = useState<Districts>(initial);
  const [loading, setLoading] = useState(false);

  const hasResults =
    districts.congressional_district ||
    districts.state_senate_district ||
    districts.state_assembly_district ||
    districts.county;

  const handleLookup = async () => {
    setLoading(true);
    const result = await lookupContactDistrictsAction(contactId);
    setLoading(false);
    if ('error' in result && result.error) {
      toast.error(result.error);
    } else if (result.districts) {
      setDistricts(result.districts as Districts);
      toast.success('Districts updated');
    }
  };

  const rows: { label: string; value: string | null }[] = [
    { label: 'Congressional', value: districts.congressional_district },
    { label: 'State Senate', value: districts.state_senate_district },
    { label: 'State Assembly', value: districts.state_assembly_district },
    { label: 'County', value: districts.county },
  ];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Landmark className="h-4 w-4" /> Political districts
          </CardTitle>
          {hasAddress && (
            <Button size="sm" variant="outline" onClick={handleLookup} disabled={loading}>
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Looking up…</>
              ) : hasResults ? (
                <><RefreshCw className="h-4 w-4 mr-1" /> Refresh</>
              ) : (
                'Look up districts'
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {!hasAddress ? (
          <p className="text-sm text-muted-foreground py-1">
            Add a street address (plus city/state or ZIP) above to look up this contact&apos;s districts.
          </p>
        ) : !hasResults ? (
          <p className="text-sm text-muted-foreground py-1">
            No districts looked up yet. Click &ldquo;Look up districts&rdquo; to resolve them from the address.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {rows.map((r) => (
                <div key={r.label} className="flex flex-col">
                  <span className="text-xs font-medium text-muted-foreground">{r.label}</span>
                  <span className="text-sm">{r.value || '—'}</span>
                </div>
              ))}
            </div>
            {districts.districts_updated_at && (
              <p className="text-xs text-muted-foreground pt-1">
                Updated {format(new Date(districts.districts_updated_at), 'MMM d, yyyy')}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
