'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, Loader2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { saveRegionsAction } from './regions-actions';

interface RegionsEditorProps {
  initialRegions: string[];
}

export default function RegionsEditor({ initialRegions }: RegionsEditorProps) {
  const [regions, setRegions] = useState<string[]>(initialRegions);
  const [newRegion, setNewRegion] = useState('');
  const [pending, startTransition] = useTransition();

  const addRegion = () => {
    const trimmed = newRegion.trim();
    if (!trimmed) return;
    if (regions.some((r) => r.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Region already exists');
      return;
    }
    setRegions((prev) => [...prev, trimmed]);
    setNewRegion('');
  };

  const removeRegion = (index: number) => {
    setRegions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRegion = (index: number, value: string) => {
    setRegions((prev) => prev.map((r, i) => (i === index ? value : r)));
  };

  const save = () => {
    startTransition(async () => {
      const res = await saveRegionsAction(regions);
      if ('error' in res) {
        toast.error(res.error);
      } else {
        toast.success('Regions saved');
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addRegion();
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-2 text-foreground">Regions</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Customize the region options available for organizations and contacts on your team.
      </p>

      <div className="space-y-2 mb-4">
        {regions.map((region, index) => (
          <div key={index} className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
            <Input
              value={region}
              onChange={(e) => updateRegion(index, e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 flex-shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeRegion(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-6">
        <Input
          value={newRegion}
          onChange={(e) => setNewRegion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a region..."
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRegion}
          disabled={!newRegion.trim()}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      <Button onClick={save} disabled={pending || regions.length === 0}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          'Save regions'
        )}
      </Button>
    </div>
  );
}
