'use client';

import { useState, useMemo, useDeferredValue } from 'react';
import { SearchBar } from '@/components/ui/search-bar';
import { ContactsTable } from '@/components/contacts/contacts-table';
import { ContactsGrid } from '@/components/contacts/contacts-grid';
import { ContactWithOrganization } from '@/lib/db/supabase-queries';
import { deleteContactAction } from '@/app/app/organizations/[id]/contact-actions';
import { bulkAddContactsToCategoryAction, bulkUpdateEngagementLevelAction } from '@/app/app/contacts/[id]/category-actions';
import MergeDuplicatesDialog from './merge-duplicates-dialog';
import ManualMergeContactsDialog from './manual-merge-dialog';
import AIMessageDialog from './ai-message-dialog';
import { Button } from '@/components/ui/button';
import { GitMerge, X, Tag, TrendingUp, UserCheck, Zap, Download, MapPin, User, Sparkles } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface Category {
  id: number;
  name: string;
  color: string;
}

interface TeamMember {
  id: number;
  name: string | null;
  email: string;
}

interface ContactsListProps {
  initialContacts: ContactWithOrganization[];
  teamId: number;
  categories: Category[];
  assignmentMap: Record<number, number[]>;
  teamMembers: TeamMember[];
  currentUserId: number | null;
  organizations: { id: number; name: string }[];
  regionOptions?: string[];
  contactOrganizerMap?: Record<number, number[]>;
}

function BulkTagDialog({
  open,
  onOpenChange,
  categories,
  selectedCount,
  onTag,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: Category[];
  selectedCount: number;
  onTag: (categoryId: number) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const handleTag = async (categoryId: number) => {
    setLoading(true);
    await onTag(categoryId);
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Tag {selectedCount} contact{selectedCount !== 1 ? 's' : ''}</DialogTitle>
          <DialogDescription>Choose a category to apply to the selected contacts.</DialogDescription>
        </DialogHeader>
        <div className="border border-border/50 rounded-lg divide-y divide-border/30 max-h-72 overflow-y-auto">
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground p-3">No categories yet.</p>
          )}
          {categories.map((cat) => (
            <button
              key={cat.id}
              disabled={loading}
              onClick={() => handleTag(cat.id)}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/40 transition-colors disabled:opacity-50"
            >
              {cat.name}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const ENGAGEMENT_LEVELS = [
  { value: 'potential',    label: 'Potential (Level 0)' },
  { value: 'learner',      label: 'Learner (Level 1)' },
  { value: 'participator', label: 'Participator (Level 2)' },
  { value: 'attender',     label: 'Attender (Level 3)' },
  { value: 'activist',     label: 'Activist (Level 4)' },
];

function BulkLevelDialog({
  open,
  onOpenChange,
  selectedCount,
  onUpdate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedCount: number;
  onUpdate: (level: string) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const handleSelect = async (level: string) => {
    setLoading(true);
    await onUpdate(level);
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Set engagement level for {selectedCount} contact{selectedCount !== 1 ? 's' : ''}</DialogTitle>
          <DialogDescription>Choose a level to apply to the selected contacts.</DialogDescription>
        </DialogHeader>
        <div className="border border-border/50 rounded-lg divide-y divide-border/30">
          {ENGAGEMENT_LEVELS.map((lvl) => (
            <button
              key={lvl.value}
              disabled={loading}
              onClick={() => handleSelect(lvl.value)}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/40 transition-colors disabled:opacity-50"
            >
              {lvl.label}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ContactsList({ initialContacts, categories, assignmentMap, teamMembers, currentUserId, organizations, regionOptions = [], contactOrganizerMap = {} }: ContactsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [contacts, setContacts] = useState(initialContacts);
  const [selectionMode, setSelectionMode] = useState<null | 'merge' | 'tag' | 'level' | 'message'>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [levelDialogOpen, setLevelDialogOpen] = useState(false);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  // Track assignments locally so category columns update after bulk tagging
  const [localAssignments, setLocalAssignments] = useState(assignmentMap);
  const [myContactsOnly, setMyContactsOnly] = useState(false);
  const [committedOnly, setCommittedOnly] = useState(false);
  const [regionFilter, setRegionFilter] = useState('');
  const [organizerFilter, setOrganizerFilter] = useState('');

  const filteredContacts = useMemo(() => {
    let list = contacts;
    if (myContactsOnly && currentUserId) {
      list = list.filter((c) => (contactOrganizerMap[c.id] || []).includes(currentUserId));
    }
    if (committedOnly) {
      list = list.filter((c) => (c as any).action_committed === true);
    }
    if (regionFilter) {
      list = list.filter((c) => ((c as any).regions || []).includes(regionFilter));
    }
    if (organizerFilter) {
      const oid = parseInt(organizerFilter, 10);
      list = list.filter((c) => (contactOrganizerMap[c.id] || []).includes(oid));
    }
    if (!deferredSearchQuery) return list;
    const query = deferredSearchQuery.toLowerCase();
    return list.filter(
      (contact) =>
        contact.name.toLowerCase().includes(query) ||
        contact.email?.toLowerCase().includes(query) ||
        contact.phone?.toLowerCase().includes(query) ||
        contact.city?.toLowerCase().includes(query) ||
        ((contact as any).regions || []).some((r: string) => r.toLowerCase().includes(query)) ||
        contact.organization?.name?.toLowerCase().includes(query)
    );
  }, [contacts, deferredSearchQuery, myContactsOnly, committedOnly, regionFilter, organizerFilter, currentUserId]);

  const handleExportCsv = () => {
    const rows = filteredContacts;
    const headers = ['Name', 'Email', 'Phone', 'City', 'State', 'Region', 'Organization', 'Engagement level', 'Committed to weekly action'];
    const escape = (v: string | null | undefined) => {
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      headers.join(','),
      ...rows.map((c) => [
        escape(c.name),
        escape(c.email),
        escape(c.phone),
        escape(c.city),
        escape(c.state),
        escape(((c as any).regions || []).join('; ')),
        escape((c as any).organization?.name),
        escape((c as any).engagement_level),
        escape((c as any).action_committed ? 'Yes' : 'No'),
      ].join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleMerged = (survivorId: number, removedIds: number[]) => {
    setContacts((prev) => prev.filter((c) => !removedIds.includes(c.id)));
    setSelectedIds(new Set());
    setSelectionMode(null);
  };

  const handleDelete = async (contact: ContactWithOrganization) => {
    const result = await deleteContactAction({
      id: contact.id,
      organizationId: contact.organization_id || 0,
    });
    if ('error' in result && result.error) {
      toast.error(result.error);
    } else {
      setContacts((prev) => prev.filter((c) => c.id !== contact.id));
      toast.success('Contact deleted');
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCancelSelection = () => {
    setSelectionMode(null);
    setSelectedIds(new Set());
  };

  const handleBulkTag = async (categoryId: number) => {
    const ids = Array.from(selectedIds);
    const result = await bulkAddContactsToCategoryAction(ids, categoryId);
    if ('error' in result && result.error) {
      toast.error(result.error);
      return;
    }
    // Update local assignment map optimistically
    setLocalAssignments((prev) => {
      const next = { ...prev };
      for (const id of ids) {
        if (!next[id]) next[id] = [];
        if (!next[id].includes(categoryId)) next[id] = [...next[id], categoryId];
      }
      return next;
    });
    toast.success(typeof result.success === 'string' ? result.success : 'Tagged successfully');
    setSelectionMode(null);
    setSelectedIds(new Set());
  };

  const handleBulkLevel = async (level: string) => {
    const ids = Array.from(selectedIds);
    const result = await bulkUpdateEngagementLevelAction(ids, level);
    if ('error' in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(typeof result.success === 'string' ? result.success : 'Updated successfully');
    setSelectionMode(null);
    setSelectedIds(new Set());
  };

  const selectedContacts = useMemo(
    () => contacts.filter((c) => selectedIds.has(c.id)),
    [contacts, selectedIds]
  );

  return (
    <div className="space-y-6">
      {/* Search + actions bar */}
      <div className="flex gap-2 sticky top-0 z-10 bg-background pb-4 -mx-6 lg:-mx-8 px-6 lg:px-8 -mt-6 pt-6">
        <div className="w-48 sm:w-64 lg:w-80 flex-shrink-0">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search contacts..."
            className="w-full"
          />
        </div>

        <Select value={regionFilter || '__all__'} onValueChange={(v) => setRegionFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className={`w-44 flex-shrink-0 h-9 text-sm ${regionFilter ? 'border-primary text-primary' : ''}`}>
            <MapPin className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
            <SelectValue placeholder="All regions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All regions</SelectItem>
            {regionOptions.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {teamMembers.length > 0 && (
          <Select value={organizerFilter || '__all__'} onValueChange={(v) => setOrganizerFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className={`w-44 flex-shrink-0 h-9 text-sm ${organizerFilter ? 'border-primary text-primary' : ''}`}>
              <User className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
              <SelectValue placeholder="All organizers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All organizers</SelectItem>
              {teamMembers.map((m) => (
                <SelectItem key={m.id} value={m.id.toString()}>{m.name || m.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex-1 flex items-center justify-end gap-2">
          {selectionMode === 'message' ? (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {selectedIds.size} selected
              </span>
              <Button variant="outline" size="sm" onClick={handleCancelSelection} className="flex-shrink-0">
                <X className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Cancel</span>
              </Button>
              <Button
                size="sm"
                onClick={() => setMessageDialogOpen(true)}
                disabled={selectedIds.size === 0}
                className="flex-shrink-0"
              >
                <Sparkles className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Craft messages{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}</span>
                <span className="sm:hidden">{selectedIds.size > 0 ? selectedIds.size : 'Message'}</span>
              </Button>
            </>
          ) : selectionMode === 'level' ? (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {selectedIds.size} selected
              </span>
              <Button variant="outline" size="sm" onClick={handleCancelSelection} className="flex-shrink-0">
                <X className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Cancel</span>
              </Button>
              <Button
                size="sm"
                onClick={() => setLevelDialogOpen(true)}
                disabled={selectedIds.size === 0}
                className="flex-shrink-0"
              >
                <TrendingUp className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Set level{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}</span>
                <span className="sm:hidden">{selectedIds.size > 0 ? selectedIds.size : 'Level'}</span>
              </Button>
            </>
          ) : selectionMode === 'tag' ? (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {selectedIds.size} selected
              </span>
              <Button variant="outline" size="sm" onClick={handleCancelSelection} className="flex-shrink-0">
                <X className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Cancel</span>
              </Button>
              <Button
                size="sm"
                onClick={() => setTagDialogOpen(true)}
                disabled={selectedIds.size === 0}
                className="flex-shrink-0"
              >
                <Tag className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Tag {selectedIds.size > 0 ? `${selectedIds.size} contacts` : ''}</span>
                <span className="sm:hidden">{selectedIds.size > 0 ? selectedIds.size : 'Tag'}</span>
              </Button>
            </>
          ) : selectionMode === 'merge' ? (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {selectedIds.size} selected
              </span>
              <Button variant="outline" size="sm" onClick={handleCancelSelection} className="flex-shrink-0">
                <X className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Cancel</span>
              </Button>
              <Button
                size="sm"
                onClick={() => setMergeDialogOpen(true)}
                disabled={selectedIds.size < 2}
                className="flex-shrink-0"
              >
                <GitMerge className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Merge {selectedIds.size > 0 ? `${selectedIds.size} contacts` : ''}</span>
                <span className="sm:hidden">{selectedIds.size > 0 ? selectedIds.size : 'Merge'}</span>
              </Button>
            </>
          ) : (
            <>
              {currentUserId && (
                <Button
                  variant={myContactsOnly ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMyContactsOnly((v) => !v)}
                  className="flex-shrink-0 transition-all duration-150"
                >
                  <UserCheck className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">My contacts</span>
                </Button>
              )}
              <Button
                variant={committedOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCommittedOnly((v) => !v)}
                className="flex-shrink-0 transition-all duration-150"
              >
                <Zap className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Committed</span>
              </Button>
              <MergeDuplicatesDialog contacts={contacts} onMerged={handleMerged} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectionMode('level')}
                className="flex-shrink-0 border-border hover:bg-accent hover:border-foreground/20 transition-all duration-150"
              >
                <TrendingUp className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Set level</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectionMode('tag')}
                className="flex-shrink-0 border-border hover:bg-accent hover:border-foreground/20 transition-all duration-150"
              >
                <Tag className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Tag contacts</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectionMode('message')}
                className="flex-shrink-0 border-border hover:bg-accent hover:border-foreground/20 transition-all duration-150"
              >
                <Sparkles className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">AI message</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectionMode('merge')}
                className="flex-shrink-0 border-border hover:bg-accent hover:border-foreground/20 transition-all duration-150"
              >
                <GitMerge className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Select to merge</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                className="flex-shrink-0 border-border hover:bg-accent hover:border-foreground/20 transition-all duration-150"
              >
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Export{filteredContacts.length < contacts.length ? ` (${filteredContacts.length})` : ''}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {selectionMode && (
        <p className="text-sm text-muted-foreground -mt-2">
          {selectionMode === 'message'
            ? 'Select contacts to craft AI-personalized messages for.'
            : selectionMode === 'level'
            ? 'Select contacts to bulk-update their engagement level.'
            : selectionMode === 'tag'
            ? 'Select contacts to tag into a category.'
            : 'Select 2 or more contacts to merge.'}
          {selectedIds.size > 0 && ` ${selectedIds.size} selected.`}
        </p>
      )}

      {searchQuery && (
        <div className="text-sm text-muted-foreground">
          Showing {filteredContacts.length} of {contacts.length} contacts
        </div>
      )}

      {/* Mobile: Card Grid */}
      <div className="lg:hidden">
        <ContactsGrid
          contacts={filteredContacts}
          onDelete={selectionMode ? undefined : handleDelete}
          selectedIds={selectionMode ? selectedIds : undefined}
          onToggleSelect={selectionMode ? handleToggleSelect : undefined}
        />

      </div>

      {/* Desktop: Table */}
      <div className="hidden lg:block">
        <ContactsTable
          contacts={filteredContacts}
          onDelete={selectionMode ? undefined : handleDelete}
          selectedIds={selectionMode ? selectedIds : undefined}
          onToggleSelect={selectionMode ? handleToggleSelect : undefined}
          categories={categories}
          assignmentMap={localAssignments}
          teamMembers={teamMembers}
          currentUserId={currentUserId}
          organizations={organizations}
          regionOptions={regionOptions}
          contactOrganizerMap={contactOrganizerMap}
        />
      </div>

      {mergeDialogOpen && selectedContacts.length >= 2 && (
        <ManualMergeContactsDialog
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          contacts={selectedContacts}
          onMerged={handleMerged}
        />
      )}

      <BulkTagDialog
        open={tagDialogOpen}
        onOpenChange={setTagDialogOpen}
        categories={categories}
        selectedCount={selectedIds.size}
        onTag={handleBulkTag}
      />

      <BulkLevelDialog
        open={levelDialogOpen}
        onOpenChange={setLevelDialogOpen}
        selectedCount={selectedIds.size}
        onUpdate={handleBulkLevel}
      />

      <AIMessageDialog
        open={messageDialogOpen}
        onOpenChange={(v) => {
          setMessageDialogOpen(v);
          if (!v) {
            setSelectionMode(null);
            setSelectedIds(new Set());
          }
        }}
        selectedCount={selectedIds.size}
        selectedIds={Array.from(selectedIds)}
      />
    </div>
  );
}
