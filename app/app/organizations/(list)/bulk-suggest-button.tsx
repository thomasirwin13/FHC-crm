'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { suggestOrganizationsBatchAction, type SuggestionItem } from '@/app/app/organizations/enrich-actions';
import OrgSuggestionReview from '@/app/app/organizations/org-suggestion-review';

export default function BulkSuggestButton({ organizationIds }: { organizationIds: number[] }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [items, setItems] = useState<SuggestionItem[]>([]);
  const [open, setOpen] = useState(false);

  const handleClick = async () => {
    if (organizationIds.length === 0) {
      toast.info('No organizations to look up.');
      return;
    }
    setRunning(true);
    setProgress(0);
    const collected: SuggestionItem[] = [];
    const BATCH = 5;
    try {
      for (let i = 0; i < organizationIds.length; i += BATCH) {
        const chunk = organizationIds.slice(i, i + BATCH);
        const result = await suggestOrganizationsBatchAction(chunk);
        if ('error' in result && result.error) {
          toast.error(result.error);
          break;
        }
        if (result.items) collected.push(...result.items);
        setProgress(Math.min(i + BATCH, organizationIds.length));
      }
    } finally {
      setRunning(false);
    }

    if (collected.length === 0) {
      toast.info('No suggestions could be generated.');
      return;
    }
    setItems(collected);
    setOpen(true);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={running}
        className="flex-shrink-0 border-border hover:bg-accent hover:border-foreground/20 transition-all duration-150"
        title="Use AI to suggest website, address, type, description, and region for all organizations"
      >
        {running ? (
          <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 sm:mr-2" />
        )}
        <span className="hidden sm:inline">
          {running ? `Suggesting… ${progress}/${organizationIds.length}` : 'Suggest details'}
        </span>
      </Button>
      {items.length > 0 && (
        <OrgSuggestionReview items={items} open={open} onOpenChange={setOpen} />
      )}
    </>
  );
}
