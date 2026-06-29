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
import { Tag, Users, Zap, ChevronDown, ChevronUp, Trash2, Plus, GitMerge, Check, AlertCircle, Building2, Mail } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { createCategoryAction, deleteCategoryAction, mergeCategoriesAction } from '@/app/app/contacts/[id]/category-actions';
import { getCategoryClasses } from '@/app/app/contacts/[id]/categories-section';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

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

interface OrgRow {
  id: number;
  name: string;
  industry?: string;
  location?: string;
  status?: string;
}

interface ReportsClientProps {
  categoryCounts: CategoryCount[];
  allCategories: { id: number; name: string; color: string }[];
  categoryContacts: Record<number, Contact[]>;
  committedCount: number;
  totalCount: number;
  methodCounts: Record<string, number>;
  committedContacts: Contact[];
  noEmailContacts: Contact[];
  noOrgContacts: Contact[];
  noContactOrgs: OrgRow[];
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
              <td className="p-2.5 text-muted-foreground hidden sm:table-cell">{c.email || 'â€”'}</td>
              <td className="p-2.5 text-muted-foreground hidden md:table-cell">{c.phone || 'â€”'}</td>
              <td className="p-2.5 text-muted-foreground hidden lg:table-cell">
                {[c.city, c.state].filter(Boolean).join(', ') || 'â€”'}
              </td>
              <td className="p-2.5 text-muted-foreground hidden md:table-cell">
                {c.preferred_contact_method ? CONTACT_METHOD_LABELS[c.preferred_contact_method] ?? c.preferred_contact_method : 'â€”'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrgTable({ orgs }: { orgs: { id: number; name: string; industry?: string; location?: string; status?: string }[] }) {
  if (orgs.length === 0) return <p className="text-sm text-muted-foreground py-3 px-1">No organizations in this group.</p>;
  return (
    <div className="border border-border/50 rounded-lg overflow-hidden mt-3">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr className="border-b border-border">
            <th className="text-left p-2.5 font-medium text-muted-foreground">Name</th>
            <th className="text-left p-2.5 font-medium text-muted-foreground hidden sm:table-cell">Industry</th>
            <th className="text-left p-2.5 font-medium text-muted-foreground hidden md:table-cell">Location</th>
            <th className="text-left p-2.5 font-medium text-muted-foreground hidden sm:table-cell">Status</th>
          </tr>
        </thead>
        <tbody>
          {orgs.map((o) => (
            <tr key={o.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
              <td className="p-2.5">
                <Link href={`/app/organizations/${o.id}`} className="font-medium hover:underline underline-offset-2">{o.name}</Link>
              </td>
              <td className="p-2.5 text-muted-foreground hidden sm:table-cell">{o.industry || 'â€”'}</td>
              <td className="p-2.5 text-muted-foreground hidden md:table-cell">{o.location || 'â€”'}</td>
              <td className="p-2.5 text-muted-foreground hidden sm:table-cell">{o.status || 'â€”'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DataQualityRow({
  icon, label, count, expandId, expanded, onToggle, children,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  expandId: string;
  expanded: number | string | null;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  const isOpen = expanded === expandId;
  return (
    <Card className="border-border/50">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/20 transition-colors rounded-lg"
        onClick={() => onToggle(expandId)}
      >
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-sm font-medium">{label}</span>
          <Badge variant={count === 0 ? 'secondary' : 'destructive'} className="text-xs">
            {count}
          </Badge>
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </div>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </Card>
  );
}

function MergeCategoriesDialog({
  categories,
  onMerged,
}: {
  categories: { id: number; name: string; color: string }[];
  onMerged: (primaryId: number, removedIds: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [primaryId, setPrimaryId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [merging, setMerging] = useState(false);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) { setPrimaryId(null); setSelectedIds(new Set()); }
  };

  const handleMerge = async () => {
    if (!primaryId || selectedIds.size < 2) return;
    const secondaryIds = Array.from(selectedIds).filter((id) => id !== primaryId);
    if (secondaryIds.length === 0) return;
    setMerging(true);
    const result = await mergeCategoriesAction(primaryId, secondaryIds);
    if ('error' in result && result.error) {
      toast.error(result.error);
      setMerging(false);
      return;
    }
    toast.success(result.success);
    onMerged(primaryId, secondaryIds);
    handleOpenChange(false);
    setMerging(false);
  };

  const selectedList = Array.from(selectedIds);
  const canMerge = selectedIds.size >= 2 && primaryId !== null && selectedIds.has(primaryId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <GitMerge className="h-4 w-4 mr-1" /> Merge
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Merge categories</DialogTitle>
          <DialogDescription>
            Select 2 or more categories to merge. Then choose which one to keep â€” the others will be removed and their contacts transferred.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Step 1: select categories */}
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">1. Select categories to merge</p>
          <div className="border border-border/50 rounded-lg divide-y divide-border/30 max-h-56 overflow-y-auto">
            {categories.map((cat) => {
              const cls = getCategoryClasses(cat.color);
              const checked = selectedIds.has(cat.id);
              return (
                <label key={cat.id} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${checked ? 'bg-primary/5' : 'hover:bg-muted/40'}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelect(cat.id)}
                    className="h-4 w-4 flex-shrink-0 cursor-pointer"
                  />
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cls.bg} ${cls.text}`}>
                    {cat.name}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Step 2: pick primary */}
          {selectedIds.size >= 2 && (
            <>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">2. Which one to keep?</p>
              <div className="border border-border/50 rounded-lg divide-y divide-border/30">
                {categories.filter((c) => selectedIds.has(c.id)).map((cat) => {
                  const cls = getCategoryClasses(cat.color);
                  return (
                    <label key={cat.id} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${primaryId === cat.id ? 'bg-primary/5' : 'hover:bg-muted/40'}`}>
                      <input
                        type="radio"
                        name="merge-primary"
                        checked={primaryId === cat.id}
                        onChange={() => setPrimaryId(cat.id)}
                        className="h-4 w-4 flex-shrink-0 cursor-pointer"
                      />
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cls.bg} ${cls.text}`}>
                        {cat.name}
                      </span>
                      {primaryId === cat.id && <span className="text-xs text-muted-foreground ml-auto">keep</span>}
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-between gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={merging}>Cancel</Button>
          <Button onClick={handleMerge} disabled={!canMerge || merging}>
            {merging ? 'Mergingâ€¦' : `Merge ${selectedIds.size > 0 ? selectedIds.size : ''} categories`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
  noEmailContacts,
  noOrgContacts,
  noContactOrgs,
}: ReportsClientProps) {
  const [categoryCounts, setCategoryCounts] = useState(initialCategoryCounts);
  const [expanded, setExpanded] = useState<number | string | null>(null);

  const handleMergeCategories = (primaryId: number, removedIds: number[]) => {
    setCategoryCounts((prev) => {
      const removedCounts = prev.filter((c) => removedIds.includes(c.id)).reduce((s, c) => s + c.count, 0);
      return prev
        .filter((c) => !removedIds.includes(c.id))
        .map((c) => (c.id === primaryId ? { ...c, count: c.count + removedCounts } : c));
    });
    if (removedIds.includes(expanded as number)) setExpanded(null);
  };
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('blue');
  const [creating, setCreating] = useState(false);

  const toggle = (id: number | string) =>
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
          <div className="flex items-center gap-2">
            {categoryCounts.length >= 2 && (
              <MergeCategoriesDialog
                categories={categoryCounts}
                onMerged={handleMergeCategories}
              />
            )}
            <Button variant="outline" size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="h-4 w-4 mr-1" /> New category
            </Button>
          </div>
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
                  {creating ? 'Creatingâ€¦' : 'Create'}
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

      {/* Data quality reports */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <AlertCircle className="h-5 w-5" /> Data quality
        </h2>

        {/* No email */}
        <DataQualityRow
          icon={<Mail className="h-4 w-4" />}
          label="Contacts with no email"
          count={noEmailContacts.length}
          expandId="no-email"
          expanded={expanded}
          onToggle={toggle}
        >
          <ContactTable contacts={noEmailContacts} />
        </DataQualityRow>

        {/* No organization */}
        <DataQualityRow
          icon={<Building2 className="h-4 w-4" />}
          label="Contacts with no organization"
          count={noOrgContacts.length}
          expandId="no-org"
          expanded={expanded}
          onToggle={toggle}
        >
          <ContactTable contacts={noOrgContacts} />
        </DataQualityRow>

        {/* Orgs with no contacts */}
        <DataQualityRow
          icon={<Users className="h-4 w-4" />}
          label="Organizations with no contacts"
          count={noContactOrgs.length}
          expandId="no-contacts"
          expanded={expanded}
          onToggle={toggle}
        >
          <OrgTable orgs={noContactOrgs} />
        </DataQualityRow>
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

