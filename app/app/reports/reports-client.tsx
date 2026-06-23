'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tag, Users, Zap, ChevronDown, ChevronUp, Trash2, Plus } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { createCategoryAction, deleteCategoryAction } from '@/app/app/contacts/[id]/category-actions';
import { getCategoryClasses } from '@/app/app/contacts/[id]/categories-section';

const CONTACT_METHOD_LABELS: Record<string, string> = {
  custom_email: 'Custom email',
  email_newsletter: 'Email newsletter',
  custom_text: 'Custom text',
  whatsapp: 'WhatsApp',
  not_set: 'Not set',
};

const COLORS = [
  { value: 'blue', label: 'Blue' },
  { value: 'green', label: 'Green' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'red', label: 'Red' },
  { value: 'purple', label: 'Purple' },
  { value: 'orange', label: 'Orange' },
  { value: 'gray', label: 'Gray' },
];

interface Contact {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  preferred_contact_method?: string;
}

interface CategoryCount {
  id: number;
  name: string;
  color: string;
  count: number;
}

interface ReportsClientProps {
  categoryCounts: CategoryCount[];
  allCategories: { id: number; name: string; color: string }[];
  categoryContacts: Record<number, Contact[]>;
  committedCount: number;
  totalCount: number;
  methodCounts: Record<string, number>;
  committedContacts: Contact[];
}

function ContactTable({ contacts }: { contacts: Contact[] }) {
  if (contacts.length === 0) return <p className="text-sm text-muted-foreground py-3 px-1">No contacts in this group.</p>;
  return (
    <div className="border border-border/50 rounded-lg overflow-hidden mt-3">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr className="border-b border-border">
            <th className="text-left p-2.5 font-medium text-muted-foreground">Name</th>
            <th className="text-left p-2.5 font-medium text-muted-foreground hidden sm:table-cell">Email</th>
            <th className="text-left p-2.5 font-medium text-muted-foreground hidden md:table-cell">Phone</th>
            <th className="text-left p-2.5 font-medium text-muted-foreground hidden lg:table-cell">Location</th>
            <th className="text-left p-2.5 font-medium text-muted-foreground hidden md:table-cell">Pref. method</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => (
            <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
              <td className="p-2.5">
                <Link href={`/app/contacts/${c.id}`} className="font-medium hover:underline underline-offset-2">
                  {c.name}
                </Link>
              </td>
              <td className="p-2.5 text-muted-foreground hidden sm:table-cell">{c.email || '—'}</td>
              <td className="p-2.5 text-muted-foreground hidden md:table-cell">{c.phone || '—'}</td>
              <td className="p-2.5 text-muted-foreground hidden lg:table-cell">
                {[c.city, c.state].filter(Boolean).join(', ') || '—'}
              </td>
              <td className="p-2.5 text-muted-foreground hidden md:table-cell">
                {c.preferred_contact_method ? CONTACT_METHOD_LABELS[c.preferred_contact_method] ?? c.preferred_contact_method : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportsClient({
  categoryCounts: initialCategoryCounts,
  allCategories: initialAllCategories,
  categoryContacts,
  committedCount,
  totalCount,
  methodCounts,
  committedContacts,
}: ReportsClientProps) {
  const [categoryCounts, setCategoryCounts] = useState(initialCategoryCounts);
  const [expanded, setExpanded] = useState<number | 'committed' | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('blue');
  const [creating, setCreating] = useState(false);

  const toggle = (id: number | 'committed') =>
    setExpanded((prev) => (prev === id ? null : id));

  const handleCreateCategory = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const result = await createCategoryAction(newName, newColor);
    if ('error' in result && result.error) {
      toast.error(result.error);
    } else if (result.category) {
      const cat = result.category as { id: number; name: string; color: string };
      setCategoryCounts((prev) => [...prev, { ...cat, count: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName(''); setNewColor('blue'); setShowCreate(false);
      toast.success(`Category "${cat.name}" created`);
    }
    setCreating(false);
  };

  const handleDeleteCategory = async (id: number, name: string) => {
    if (!confirm(`Delete category "${name}"? This will remove it from all contacts.`)) return;
    const result = await deleteCategoryAction(id);
    if ('error' in result && result.error) {
      toast.error(result.error);
    } else {
      setCategoryCounts((prev) => prev.filter((c) => c.id !== id));
      if (expanded === id) setExpanded(null);
      toast.success(`Category "${name}" deleted`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total contacts</p>
            <p className="text-3xl font-bold">{totalCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Committed to action</p>
            <p className="text-3xl font-bold">{committedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {totalCount > 0 ? Math.round((committedCount / totalCount) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50 col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Categories</p>
            <p className="text-3xl font-bold">{categoryCounts.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Categories section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Tag className="h-5 w-5" /> Categories
          </h2>
          <Button variant="outline" size="sm" onClick={() => setShowCreate((v) => !v)}>
            <Plus className="h-4 w-4 mr-1" /> New category
          </Button>
        </div>

        {/* Create category inline */}
        {showCreate && (
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium">New category</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Category name (e.g. Newsletter subscribers)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
                  className="flex-1"
                />
                <Select value={newColor} onValueChange={setNewColor}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLORS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={handleCreateCategory} disabled={!newName.trim() || creating}>
                  {creating ? 'Creating…' : 'Create'}
                </Button>
                <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {categoryCounts.length === 0 && !showCreate && (
          <Card className="border-border/50">
            <CardContent className="p-6 text-center text-muted-foreground text-sm">
              No categories yet. Create one to start tagging contacts.
            </CardContent>
          </Card>
        )}

        {categoryCounts.map((cat) => {
          const cls = getCategoryClasses(cat.color);
          const contacts = categoryContacts[cat.id] ?? [];
          const isOpen = expanded === cat.id;
          return (
            <Card key={cat.id} className="border-border/50">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/20 transition-colors rounded-lg"
                onClick={() => toggle(cat.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cls.bg} ${cls.text}`}>
                    {cat.name}
                  </span>
                  <Badge variant="secondary" className="text-xs">{cat.count} contact{cat.count !== 1 ? 's' : ''}</Badge>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id, cat.name); }}
                    className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                    title="Delete category"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
              {isOpen && (
                <div className="px-4 pb-4">
                  <ContactTable contacts={contacts} />
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Committed to action section */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5" /> Committed to weekly action
        </h2>

        {/* Method breakdown */}
        {committedCount > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(methodCounts).map(([method, count]) => (
              <Card key={method} className="border-border/50">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground mb-1">{CONTACT_METHOD_LABELS[method] ?? method}</p>
                  <p className="text-2xl font-bold">{count}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="border-border/50">
          <div
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/20 transition-colors rounded-lg"
            onClick={() => toggle('committed')}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">All committed contacts</span>
              <Badge variant="secondary">{committedCount}</Badge>
            </div>
            {expanded === 'committed' ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
          {expanded === 'committed' && (
            <div className="px-4 pb-4">
              <ContactTable contacts={committedContacts} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
