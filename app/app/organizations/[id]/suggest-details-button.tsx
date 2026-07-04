'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { suggestOrganizationDetailsAction, type SuggestionItem } from '@/app/app/organizations/enrich-actions';
import OrgSuggestionReview from '@/app/app/organizations/org-suggestion-review';

export default function SuggestDetailsButton({ organizationId }: { organizationId: number }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SuggestionItem[]>([]);
  const [open, setOpen] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    const result = await suggestOrganizationDetailsAction(organizationId);
    setLoading(false);
    if ('error' in result && result.error) {
      toast.error(result.error);
      return;
    }
    if (result.item) {
      setItems([result.item]);
      setOpen(true);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
        {loading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Looking up…</> : <><Sparkles className="h-4 w-4 mr-1.5" /> Suggest details</>}
      </Button>
      {items.length > 0 && (
        <OrgSuggestionReview items={items} open={open} onOpenChange={setOpen} />
      )}
    </>
  );
}
