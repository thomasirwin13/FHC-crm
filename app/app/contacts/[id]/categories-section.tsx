'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tag, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  addContactCategoryAction,
  removeContactCategoryAction,
  createCategoryAction,
} from './category-actions';

const COLORS = [
  { value: 'blue', label: 'Blue', bg: 'bg-blue-500/15', text: 'text-blue-700 dark:text-blue-400' },
  { value: 'green', label: 'Green', bg: 'bg-green-500/15', text: 'text-green-700 dark:text-green-400' },
  { value: 'yellow', label: 'Yellow', bg: 'bg-yellow-500/15', text: 'text-yellow-700 dark:text-yellow-400' },
  { value: 'red', label: 'Red', bg: 'bg-red-500/15', text: 'text-red-700 dark:text-red-400' },
  { value: 'purple', label: 'Purple', bg: 'bg-purple-500/15', text: 'text-purple-700 dark:text-purple-400' },
  { value: 'orange', label: 'Orange', bg: 'bg-orange-500/15', text: 'text-orange-700 dark:text-orange-400' },
  { value: 'gray', label: 'Gray', bg: 'bg-gray-500/15', text: 'text-gray-700 dark:text-gray-400' },
];

export function getCategoryClasses(color: string) {
  return COLORS.find((c) => c.value === color) ?? COLORS[COLORS.length - 1];
}

interface Category { id: number; name: string; color: string }

interface CategoriesSectionProps {
  contactId: number;
  initialCategories: Category[];
  allCategories: Category[];
}

export default function CategoriesSection({
  contactId,
  initialCategories,
  allCategories,
}: CategoriesSectionProps) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [teamCategories, setTeamCategories] = useState<Category[]>(allCategories);
  const [showAdd, setShowAdd] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('blue');
  const [saving, setSaving] = useState(false);

  const assignedIds = new Set(categories.map((c) => c.id));
  const available = teamCategories.filter((c) => !assignedIds.has(c.id));

  const handleAdd = async () => {
    if (!selectedId) return;
    const catId = parseInt(selectedId);
    const cat = teamCategories.find((c) => c.id === catId);
    if (!cat) return;
    setSaving(true);
    const result = await addContactCategoryAction(contactId, catId);
    if ('error' in result && result.error) { toast.error(result.error); }
    else { setCategories((prev) => [...prev, cat]); setSelectedId(''); setShowAdd(false); }
    setSaving(false);
  };

  const handleRemove = async (cat: Category) => {
    const result = await removeContactCategoryAction(contactId, cat.id);
    if ('error' in result && result.error) { toast.error(result.error); }
    else { setCategories((prev) => prev.filter((c) => c.id !== cat.id)); }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const result = await createCategoryAction(newName, newColor);
    if ('error' in result && result.error) { toast.error(result.error); }
    else if (result.category) {
      const cat = result.category as Category;
      setTeamCategories((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)));
      setCategories((prev) => [...prev, cat]);
      setNewName(''); setNewColor('blue'); setShowCreate(false); setShowAdd(false);
      toast.success(`Category "${cat.name}" created`);
    }
    setSaving(false);
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Tag className="h-4 w-4" /> Categories
          </CardTitle>
          {!showAdd && (
            <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Current categories */}
        {categories.length === 0 && !showAdd && (
          <p className="text-sm text-muted-foreground py-1">No categories assigned yet.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const cls = getCategoryClasses(cat.color);
            return (
              <span key={cat.id} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cls.bg} ${cls.text}`}>
                {cat.name}
                <button onClick={() => handleRemove(cat)} className="hover:opacity-70 transition-opacity ml-0.5">
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>

        {/* Add existing category */}
        {showAdd && !showCreate && (
          <div className="space-y-2">
            {available.length > 0 ? (
              <div className="flex gap-2">
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger className="flex-1 h-9">
                    <SelectValue placeholder="Select a category…" />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleAdd} disabled={!selectedId || saving}>Add</Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setSelectedId(''); }}>Cancel</Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">All categories are already assigned.</p>
            )}
            <button
              onClick={() => setShowCreate(true)}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              + Create a new category
            </button>
          </div>
        )}

        {/* Create new category */}
        {showCreate && (
          <div className="space-y-2 p-3 border border-border/50 rounded-lg bg-muted/20">
            <p className="text-xs font-medium text-muted-foreground">New category</p>
            <div className="flex gap-2">
              <Input
                placeholder="Category name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 h-9"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <Select value={newColor} onValueChange={setNewColor}>
                <SelectTrigger className="w-28 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLORS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className={`inline-flex items-center gap-1.5`}>
                        <span className={`h-2.5 w-2.5 rounded-full ${c.bg} border border-current`} />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || saving}>
                {saving ? 'Creating…' : 'Create & assign'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
