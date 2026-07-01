'use client';

import { useState, useMemo } from 'react';
import { SearchBar } from '@/components/ui/search-bar';
import { ContactsTable } from '@/components/contacts/contacts-table';
import { ContactsGrid } from '@/components/contacts/contacts-grid';
import { ContactWithOrganization } from '@/lib/db/supabase-queries';
import { deleteContactAction } from '@/app/app/organizations/[id]/contact-actions';
import { bulkAddContactsToCategoryAction, bulkUpdateEngagementLevelAction } from '@/app/app/contacts/[id]/category-actions';
import MergeDuplicatesDialog from './merge-duplicates-dialog';
import ManualMergeContactsDialog from './manual-merge-dialog';
import { Button } from '@/components/ui/button';
import { GitMerge, X, Tag, TrendingUp, UserCheck } from 'lucide-react';
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

export default function ContactsList({ initialContacts, categories, assignmentMap, teamMembers, currentUserId }: ContactsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState(initialContacts);
  const [selectionMode, setSelectionMode] = useState<null | 'merge' | 'tag' | 'level'>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [levelDialogOpen, setLevelDialogOpen] = useState(false);
  // Track assignments locally so category columns update after bulk tagging
  const [localAssignments, setLocalAssignments] = useState(assignmentMap);
  const [myContactsOnly, setMyContactsOnly] = useState(false);

  const filteredContacts = useMemo(() => {
    let list = contacts;
    if (myContactsOnly && currentUserId) {
      list = list.filter((c) => (c as any).assigned_user_id === currentUserId);
    }
    if (!searchQuery) return list;
    const query = searchQuery.toLowerCase();
    return list.filter(
      (contact) =>
        contact.name.toLowerCase().includes(query) ||
        contact.email?.toLowerCase().includes(query) ||
        contact.phone?.toLowerCase().includes(query) ||
        contact.city?.toLowerCase().includes(query) ||
        contact.organization?.name?.toLowerCase().includes(query)
    );
  }, [contacts, searchQuery, myContactsOnly, currentUserId]);

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

        <div className="flex-1 flex items-center justify-end gap-2">
          {selectionMode === 'level' ? (
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
                onClick={() => setSelectionMode('merge')}
                className="flex-shrink-0 border-border hover:bg-accent hover:border-foreground/20 transition-all duration-150"
              >
                <GitMerge className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Select to merge</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {selectionMode && (
        <p className="text-sm text-muted-foreground -mt-2">
          {selectionMode === 'level'
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
    </div>
  );
}
