'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
import { Tag, Users, Zap, ChevronDown, ChevronUp, Trash2, Plus, GitMerge, Check, AlertCircle, Building2, Mail, UserPlus, Search, CalendarDays, TrendingUp, MapPin, Landmark } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { createCategoryAction, deleteCategoryAction, mergeCategoriesAction, bulkAddContactsToCategoryAction, commitContactsToWeeklyActionAction } from '@/app/app/contacts/[id]/category-actions';
import { getCategoryClasses } from '@/app/app/contacts/[id]/categories-section';
import { ContactQuickView } from '@/components/contacts/contacts-table';
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
  street?: string | null;
  city?: string;
  state?: string;
  zip?: string | null;
  preferred_contact_method?: string;
  assigned_user_id?: number | null;
  engagement_level?: string | null;
  state_assembly_district?: string | null;
  state_senate_district?: string | null;
}

const ENGAGEMENT_LEVELS: { value: string; label: string }[] = [
  { value: 'activist', label: 'Activist (Level 4)' },
  { value: 'attender', label: 'Attender (Level 3)' },
  { value: 'participator', label: 'Participator (Level 2)' },
  { value: 'learner', label: 'Learner (Level 1)' },
  { value: 'potential', label: 'Potential (Level 0)' },
];

interface CategoryCount {
  id: number;
  name: string;
  color: string;
  count: number;
}

interface OrgRow {
  id: number;
  name: string;
  type?: string;
  location?: string;
  status?: string;
}

interface OneOnOneRow {
  id: number;
  date: string;
  contact_id: number;
  user_id: number | null;
  organizer_name: string | null;
  contacts: { id: number; name: string } | null;
  users: { id: number; name: string | null; email: string } | null;
}

interface TeamMember {
  id: number;
  name: string | null;
  email: string;
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
  allTeamContacts: Contact[];
  oneOnOnes: OneOnOneRow[];
  teamMembers: TeamMember[];
  organizations: { id: number; name: string }[];
}

function ContactTable({ contacts, teamMembers, onRowClick }: { contacts: Contact[]; teamMembers?: TeamMember[]; onRowClick?: (id: number) => void }) {
  if (contacts.length === 0) return <p className="text-sm text-muted-foreground py-3 px-1">No contacts in this group.</p>;
  const memberMap = teamMembers ? new Map(teamMembers.map((m) => [m.id, m.name || m.email])) : null;
  const dash = '—';
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
            {memberMap && <th className="text-left p-2.5 font-medium text-muted-foreground hidden sm:table-cell">Lead organizer</th>}
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => (
            <tr
              key={c.id}
              className={`border-b border-border/50 last:border-0 hover:bg-muted/20 ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={onRowClick ? () => onRowClick(c.id) : undefined}
            >
              <td className="p-2.5">
                <Link
                  href={`/app/contacts/${c.id}`}
                  className="font-medium hover:underline underline-offset-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {c.name}
                </Link>
              </td>
              <td className="p-2.5 text-muted-foreground hidden sm:table-cell">{c.email || dash}</td>
              <td className="p-2.5 text-muted-foreground hidden md:table-cell">{c.phone || dash}</td>
              <td className="p-2.5 text-muted-foreground hidden lg:table-cell">
                {[c.city, c.state].filter(Boolean).join(', ') || dash}
              </td>
              <td className="p-2.5 text-muted-foreground hidden md:table-cell">
                {c.preferred_contact_method ? CONTACT_METHOD_LABELS[c.preferred_contact_method] ?? c.preferred_contact_method : dash}
              </td>
              {memberMap && (
                <td className="p-2.5 text-muted-foreground hidden sm:table-cell">
                  {c.assigned_user_id ? (memberMap.get(c.assigned_user_id) ?? dash) : dash}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrgTable({ orgs }: { orgs: { id: number; name: string; type?: string; location?: string; status?: string }[] }) {
  if (orgs.length === 0) return <p className="text-sm text-muted-foreground py-3 px-1">No organizations in this group.</p>;
  return (
    <div className="border border-border/50 rounded-lg overflow-hidden mt-3">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr className="border-b border-border">
            <th className="text-left p-2.5 font-medium text-muted-foreground">Name</th>
            <th className="text-left p-2.5 font-medium text-muted-foreground hidden sm:table-cell">Type</th>
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
              <td className="p-2.5 text-muted-foreground hidden sm:table-cell">{o.type || '—'}</td>
              <td className="p-2.5 text-muted-foreground hidden md:table-cell">{o.location || '—'}</td>
              <td className="p-2.5 text-muted-foreground hidden sm:table-cell">{o.status || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DistrictGroup({
  title, groups, keyPrefix, expanded, onToggle, onRowClick,
}: {
  title: string;
  groups: [string, Contact[]][];
  keyPrefix: string;
  expanded: number | string | null;
  onToggle: (id: string) => void;
  onRowClick?: (id: number) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contacts.</p>
      ) : (
        groups.map(([label, list]) => {
          const expandId = `${keyPrefix}-${label}`;
          const isOpen = expanded === expandId;
          return (
            <Card key={expandId} className="border-border/50">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/20 transition-colors rounded-lg"
                onClick={() => onToggle(expandId)}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${label === 'Not looked up' ? 'text-muted-foreground' : ''}`}>{label}</span>
                  <Badge variant="secondary">{list.length}</Badge>
                </div>
                {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
              {isOpen && (
                <div className="px-4 pb-4">
                  <ContactTable contacts={list} onRowClick={onRowClick} />
                </div>
              )}
            </Card>
          );
        })
      )}
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
            Select 2 or more categories to merge. Then choose which one to keep — the others will be removed and their contacts transferred.
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
            {merging ? 'Merging…' : `Merge ${selectedIds.size > 0 ? selectedIds.size : ''} categories`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddContactsToCategoryDialog({
  categoryId,
  categoryName,
  allContacts,
  alreadyLinkedIds,
  onAdded,
}: {
  categoryId: number;
  categoryName: string;
  allContacts: Contact[];
  alreadyLinkedIds: Set<number>;
  onAdded: (count: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);

  const available = allContacts.filter((c) => !alreadyLinkedIds.has(c.id));

  const filtered = available.filter((c) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
  });

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selectedIds.size === 0) return;
    setAdding(true);
    const ids = Array.from(selectedIds);
    const result = await bulkAddContactsToCategoryAction(ids, categoryId);
    if ('error' in result && result.error) {
      toast.error(result.error);
      setAdding(false);
      return;
    }
    toast.success(result.success);
    onAdded(ids.length);
    setOpen(false);
    setQuery('');
    setSelectedIds(new Set());
    setAdding(false);
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) { setQuery(''); setSelectedIds(new Set()); }
  };

  if (available.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 rounded hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors"
          title="Add contacts to category"
        >
          <UserPlus className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Add contacts to &ldquo;{categoryName}&rdquo;</DialogTitle>
          <DialogDescription>
            Search and select contacts to add to this category.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9"
            autoFocus
          />
        </div>

        {selectedIds.size > 0 && (
          <p className="text-xs text-muted-foreground -mt-1">
            {selectedIds.size} contact{selectedIds.size !== 1 ? 's' : ''} selected
          </p>
        )}

        <div className="flex-1 overflow-y-auto border border-border/50 rounded-lg divide-y divide-border/30">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No contacts found.</p>
          ) : (
            filtered.map((contact) => {
              const selected = selectedIds.has(contact.id);
              return (
                <label
                  key={contact.id}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${selected ? 'bg-primary/5' : 'hover:bg-muted/40'}`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSelect(contact.id)}
                    className="h-4 w-4 flex-shrink-0 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm truncate block">{contact.name}</span>
                    {contact.email && (
                      <span className="text-xs text-muted-foreground truncate block">{contact.email}</span>
                    )}
                  </div>
                  {selected && <Badge className="text-xs h-4 px-1.5 flex-shrink-0">selected</Badge>}
                </label>
              );
            })
          )}
        </div>

        <div className="flex justify-between items-center gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={adding}>Cancel</Button>
          <Button onClick={handleAdd} disabled={selectedIds.size === 0 || adding}>
            {adding ? 'Adding…' : `Add ${selectedIds.size > 0 ? selectedIds.size : ''} contact${selectedIds.size !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const COMMIT_METHOD_OPTIONS = [
  { value: '__none__', label: 'Not set' },
  { value: 'custom_email', label: 'Custom email' },
  { value: 'email_newsletter', label: 'Email newsletter' },
  { value: 'custom_text', label: 'Custom text' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

function AddToWeeklyActionDialog({
  allContacts,
  alreadyCommittedIds,
  onAdded,
}: {
  allContacts: Contact[];
  alreadyCommittedIds: Set<number>;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [method, setMethod] = useState('__none__');
  const [adding, setAdding] = useState(false);

  const available = allContacts.filter((c) => !alreadyCommittedIds.has(c.id));

  const filtered = available.filter((c) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
  });

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) { setQuery(''); setSelectedIds(new Set()); setMethod('__none__'); }
  };

  const handleAdd = async () => {
    if (selectedIds.size === 0) return;
    setAdding(true);
    const ids = Array.from(selectedIds);
    const result = await commitContactsToWeeklyActionAction(
      ids,
      method === '__none__' ? '' : method
    );
    if ('error' in result && result.error) {
      toast.error(result.error);
      setAdding(false);
      return;
    }
    toast.success(result.success);
    onAdded();
    handleOpenChange(false);
    setAdding(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="h-4 w-4 mr-1" /> Add contacts
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add to weekly action</DialogTitle>
          <DialogDescription>
            Search and select contacts to commit to weekly action, and set their preferred contact method.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Preferred contact method</label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMIT_METHOD_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9"
            autoFocus
          />
        </div>

        {selectedIds.size > 0 && (
          <p className="text-xs text-muted-foreground -mt-1">
            {selectedIds.size} contact{selectedIds.size !== 1 ? 's' : ''} selected
          </p>
        )}

        <div className="flex-1 overflow-y-auto border border-border/50 rounded-lg divide-y divide-border/30">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No contacts found.</p>
          ) : (
            filtered.map((contact) => {
              const selected = selectedIds.has(contact.id);
              return (
                <label
                  key={contact.id}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${selected ? 'bg-primary/5' : 'hover:bg-muted/40'}`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSelect(contact.id)}
                    className="h-4 w-4 flex-shrink-0 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm truncate block">{contact.name}</span>
                    {contact.email && (
                      <span className="text-xs text-muted-foreground truncate block">{contact.email}</span>
                    )}
                  </div>
                  {selected && <Badge className="text-xs h-4 px-1.5 flex-shrink-0">selected</Badge>}
                </label>
              );
            })
          )}
        </div>

        <div className="flex justify-between items-center gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={adding}>Cancel</Button>
          <Button onClick={handleAdd} disabled={selectedIds.size === 0 || adding}>
            {adding ? 'Adding…' : `Add ${selectedIds.size > 0 ? selectedIds.size : ''} contact${selectedIds.size !== 1 ? 's' : ''}`}
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
  allTeamContacts,
  oneOnOnes,
  teamMembers,
  organizations,
}: ReportsClientProps) {
  const router = useRouter();
  const [categoryCounts, setCategoryCounts] = useState(initialCategoryCounts);
  const [expanded, setExpanded] = useState<number | string | null>(null);
  const [quickViewId, setQuickViewId] = useState<number | null>(null);

  // allTeamContacts are full contact rows at runtime; index them by id so the
  // quick-edit sheet gets complete data when a report row is clicked.
  const fullContactById = useMemo(() => {
    const map = new Map<number, any>();
    for (const c of allTeamContacts as any[]) map.set(c.id, c);
    return map;
  }, [allTeamContacts]);

  // Contacts grouped by engagement level.
  const contactsByLevel = useMemo(() => {
    const map: Record<string, Contact[]> = {};
    for (const c of allTeamContacts as any[]) {
      const lvl = (c.engagement_level || 'potential') as string;
      (map[lvl] ||= []).push(c);
    }
    return map;
  }, [allTeamContacts]);

  // Contacts missing a complete mailing address (street + city + state + ZIP).
  const missingAddress = useMemo(
    () =>
      (allTeamContacts as any[]).filter(
        (c) => !(c.street?.trim() && c.city?.trim() && c.state?.trim() && c.zip?.trim())
      ) as Contact[],
    [allTeamContacts]
  );

  // Contacts grouped by state legislative district. Districts with a value are
  // sorted naturally; contacts without a looked-up district go into a bucket last.
  const groupByDistrict = (key: 'state_assembly_district' | 'state_senate_district') => {
    const map: Record<string, Contact[]> = {};
    for (const c of allTeamContacts as any[]) {
      const label = ((c[key] as string) || '').trim() || 'Not looked up';
      (map[label] ||= []).push(c);
    }
    return Object.entries(map).sort((a, b) => {
      if (a[0] === 'Not looked up') return 1;
      if (b[0] === 'Not looked up') return -1;
      return a[0].localeCompare(b[0], undefined, { numeric: true });
    });
  };
  const byAssembly = useMemo(() => groupByDistrict('state_assembly_district'), [allTeamContacts]);
  const bySenate = useMemo(() => groupByDistrict('state_senate_district'), [allTeamContacts]);
  const [categoryLinkedIds, setCategoryLinkedIds] = useState<Record<number, Set<number>>>(() => {
    const map: Record<number, Set<number>> = {};
    for (const [catIdStr, contacts] of Object.entries(categoryContacts)) {
      map[Number(catIdStr)] = new Set((contacts as Contact[]).map((c) => c.id));
    }
    return map;
  });

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
                  <AddContactsToCategoryDialog
                    categoryId={cat.id}
                    categoryName={cat.name}
                    allContacts={allTeamContacts}
                    alreadyLinkedIds={categoryLinkedIds[cat.id] ?? new Set()}
                    onAdded={(count) => {
                      setCategoryCounts((prev) =>
                        prev.map((c) => c.id === cat.id ? { ...c, count: c.count + count } : c)
                      );
                    }}
                  />
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
                  <ContactTable
                    contacts={contacts}
                    teamMembers={cat.name.toLowerCase().includes('priority') ? teamMembers : undefined}
                    onRowClick={setQuickViewId}
                  />
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
          <ContactTable contacts={noEmailContacts} onRowClick={setQuickViewId} />
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
          <ContactTable contacts={noOrgContacts} onRowClick={setQuickViewId} />
        </DataQualityRow>

        {/* Missing full address */}
        <DataQualityRow
          icon={<MapPin className="h-4 w-4" />}
          label="Contacts missing a full address"
          count={missingAddress.length}
          expandId="no-address"
          expanded={expanded}
          onToggle={toggle}
        >
          <ContactTable contacts={missingAddress} onRowClick={setQuickViewId} />
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

      {/* Contacts by engagement level */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5" /> Contacts by level
        </h2>
        {ENGAGEMENT_LEVELS.map((lvl) => {
          const list = contactsByLevel[lvl.value] || [];
          const expandId = `level-${lvl.value}`;
          const isOpen = expanded === expandId;
          return (
            <Card key={lvl.value} className="border-border/50">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/20 transition-colors rounded-lg"
                onClick={() => toggle(expandId)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{lvl.label}</span>
                  <Badge variant="secondary">{list.length}</Badge>
                </div>
                {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
              {isOpen && (
                <div className="px-4 pb-4">
                  <ContactTable contacts={list} onRowClick={setQuickViewId} />
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Contacts by legislative district */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Landmark className="h-5 w-5" /> Contacts by district
        </h2>

        <DistrictGroup
          title="State Assembly district"
          groups={byAssembly}
          keyPrefix="assembly"
          expanded={expanded}
          onToggle={toggle}
          onRowClick={setQuickViewId}
        />
        <DistrictGroup
          title="State Senate district"
          groups={bySenate}
          keyPrefix="senate"
          expanded={expanded}
          onToggle={toggle}
          onRowClick={setQuickViewId}
        />
      </div>

      {/* 1-on-1 meetings by organizer */}
      {oneOnOnes.length > 0 && (() => {
        // Group by organizer
        const byOrganizer: Record<string, { label: string; meetings: OneOnOneRow[] }> = {};
        for (const row of oneOnOnes) {
          let key: string;
          let label: string;
          if (row.users) {
            key = `user-${row.users.id}`;
            label = row.users.name || row.users.email;
          } else if (row.organizer_name) {
            key = `manual-${row.organizer_name}`;
            label = row.organizer_name;
          } else {
            key = 'unknown';
            label = 'Unknown organizer';
          }
          if (!byOrganizer[key]) byOrganizer[key] = { label, meetings: [] };
          byOrganizer[key].meetings.push(row);
        }
        const organizers = Object.entries(byOrganizer).sort((a, b) =>
          b[1].meetings.length - a[1].meetings.length
        );
        return (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CalendarDays className="h-5 w-5" /> 1-on-1 meetings by organizer
            </h2>
            <div className="text-sm text-muted-foreground">{oneOnOnes.length} total meetings logged</div>
            {organizers.map(([key, { label, meetings }]) => {
              const expandId = `ono-${key}`;
              const isOpen = expanded === expandId;
              return (
                <Card key={key} className="border-border/50">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/20 transition-colors rounded-lg"
                    onClick={() => toggle(expandId)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{label}</span>
                      <Badge variant="secondary">{meetings.length} meeting{meetings.length !== 1 ? 's' : ''}</Badge>
                    </div>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  {isOpen && (
                    <div className="px-4 pb-4">
                      <div className="border border-border/50 rounded-lg overflow-hidden mt-3">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr className="border-b border-border">
                              <th className="text-left p-2.5 font-medium text-muted-foreground">Contact</th>
                              <th className="text-left p-2.5 font-medium text-muted-foreground">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {meetings.map((m) => (
                              <tr key={m.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                                <td className="p-2.5">
                                  {m.contacts ? (
                                    <Link href={`/app/contacts/${m.contacts.id}`} className="font-medium hover:underline underline-offset-2">
                                      {m.contacts.name}
                                    </Link>
                                  ) : '—'}
                                </td>
                                <td className="p-2.5 text-muted-foreground">
                                  {new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        );
      })()}

      {/* Committed to action section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5" /> Committed to weekly action
          </h2>
          <AddToWeeklyActionDialog
            allContacts={allTeamContacts}
            alreadyCommittedIds={new Set(committedContacts.map((c) => c.id))}
            onAdded={() => router.refresh()}
          />
        </div>

        {committedCount === 0 && (
          <p className="text-sm text-muted-foreground">No contacts are currently committed to weekly action.</p>
        )}

        {committedCount > 0 && (() => {
          // Group committed contacts by preferred_contact_method
          const byMethod: Record<string, Contact[]> = {};
          for (const c of committedContacts) {
            const key = (c as any).preferred_contact_method || 'not_set';
            if (!byMethod[key]) byMethod[key] = [];
            byMethod[key].push(c);
          }
          const methodOrder = ['custom_email', 'email_newsletter', 'custom_text', 'whatsapp', 'not_set'];
          const sortedMethods = [
            ...methodOrder.filter((m) => byMethod[m]),
            ...Object.keys(byMethod).filter((m) => !methodOrder.includes(m)),
          ];

          return (
            <div className="space-y-3">
              {sortedMethods.map((method) => {
                const contacts = byMethod[method];
                const expandId = `committed-method-${method}`;
                const isOpen = expanded === expandId;
                return (
                  <Card key={method} className="border-border/50">
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/20 transition-colors rounded-lg"
                      onClick={() => toggle(expandId)}
                    >
                      <div className="flex items-center gap-3">
                        <Zap className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{CONTACT_METHOD_LABELS[method] ?? method}</span>
                        <Badge variant="secondary">{contacts.length}</Badge>
                      </div>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    {isOpen && (
                      <div className="px-4 pb-4">
                        <ContactTable contacts={contacts} onRowClick={setQuickViewId} />
                      </div>
                    )}
                  </Card>
                );
              })}

              <Card className="border-border/50">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/20 transition-colors rounded-lg"
                  onClick={() => toggle('committed-all')}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground">All committed contacts</span>
                    <Badge variant="secondary">{committedCount}</Badge>
                  </div>
                  {expanded === 'committed-all' ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
                {expanded === 'committed-all' && (
                  <div className="px-4 pb-4">
                    <ContactTable contacts={committedContacts} onRowClick={setQuickViewId} />
                  </div>
                )}
              </Card>
            </div>
          );
        })()}
      </div>

      <ContactQuickView
        contact={quickViewId ? (fullContactById.get(quickViewId) ?? null) : null}
        open={quickViewId !== null}
        onOpenChange={(v) => { if (!v) setQuickViewId(null); }}
        categories={initialAllCategories}
        assignmentMap={{}}
        teamMembers={teamMembers}
        organizations={organizations}
      />
    </div>
  );
}

