'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Loader2, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { createCategoryAction, deleteCategoryAction } from '@/app/app/contacts/[id]/category-actions';
import { getCategoryClasses } from '@/app/app/contacts/[id]/categories-section';

const COLORS = [
  { value: 'blue', label: 'Blue' },
  { value: 'green', label: 'Green' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'red', label: 'Red' },
  { value: 'purple', label: 'Purple' },
  { value: 'orange', label: 'Orange' },
  { value: 'gray', label: 'Gray' },
];

interface Category {
  id: number;
  name: string;
  color: string;
}

interface TagsEditorProps {
  initialCategories: Category[];
}

export default function TagsEditor({ initialCategories }: TagsEditorProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('blue');
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Tag already exists');
      return;
    }
    startTransition(async () => {
      const res = await createCategoryAction(trimmed, newColor);
      if ('error' in res) {
        toast.error(res.error);
      } else {
        toast.success(`Tag "${trimmed}" created — a report section has been added automatically`);
        setNewName('');
        setNewColor('blue');
        if (res.category) {
          setCategories((prev) => [...prev, res.category as Category]);
        }
        router.refresh();
      }
    });
  };

  const handleDelete = (id: number, name: string) => {
    setDeletingId(id);
    startTransition(async () => {
      const res = await deleteCategoryAction(id);
      if ('error' in res) {
        toast.error(res.error);
      } else {
        toast.success(`Tag "${name}" deleted`);
        setCategories((prev) => prev.filter((c) => c.id !== id));
        router.refresh();
      }
      setDeletingId(null);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center gap-2 mb-2">
        <Tag className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-foreground">Tags</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Manage tags for categorizing contacts. Each tag automatically gets a report section on the reports page.
      </p>

      {categories.length > 0 && (
        <div className="space-y-2 mb-4">
          {categories.map((cat) => {
            const classes = getCategoryClasses(cat.color);
            return (
              <div key={cat.id} className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}>
                  {cat.name}
                </span>
                <span className="flex-1" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  disabled={pending && deletingId === cat.id}
                  onClick={() => handleDelete(cat.id, cat.name)}
                >
                  {pending && deletingId === cat.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="New tag name..."
          className="flex-1"
          disabled={pending && deletingId === null}
        />
        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              className={`h-6 w-6 rounded-full border-2 transition-all ${
                newColor === c.value ? 'border-foreground scale-110' : 'border-transparent'
              }`}
              style={{
                backgroundColor:
                  c.value === 'blue' ? '#3b82f6' :
                  c.value === 'green' ? '#22c55e' :
                  c.value === 'yellow' ? '#eab308' :
                  c.value === 'red' ? '#ef4444' :
                  c.value === 'purple' ? '#a855f7' :
                  c.value === 'orange' ? '#f97316' :
                  '#6b7280',
              }}
              onClick={() => setNewColor(c.value)}
            />
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCreate}
          disabled={!newName.trim() || (pending && deletingId === null)}
        >
          {pending && deletingId === null ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-1" />
          )}
          Add
        </Button>
      </div>
    </div>
  );
}
