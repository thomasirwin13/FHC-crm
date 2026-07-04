'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Landmark, Loader2 } from 'lucide-react';
import { bulkLookupDistrictsAction } from '@/app/app/contacts/[id]/district-actions';
import { toast } from 'sonner';

export default function BulkDistrictsButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    const result = await bulkLookupDistrictsAction();
    setLoading(false);
    if ('error' in result && result.error) {
      toast.error(result.error);
      return;
    }
    if (result.total === 0) {
      toast.info('No contacts with a street address left to look up.');
      return;
    }
    const parts = [`${result.updated} updated`];
    if (result.failed) parts.push(`${result.failed} could not be resolved`);
    toast.success(`Districts looked up: ${parts.join(', ')}.`);
    router.refresh();
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className="flex-shrink-0 border-border hover:bg-accent hover:border-foreground/20 transition-all duration-150"
      title="Look up political districts for contacts with a street address"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
      ) : (
        <Landmark className="h-4 w-4 sm:mr-2" />
      )}
      <span className="hidden sm:inline">{loading ? 'Looking up…' : 'Look up districts'}</span>
    </Button>
  );
}
