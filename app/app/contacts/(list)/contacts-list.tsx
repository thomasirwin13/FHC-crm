'use client';

import { useState, useMemo } from 'react';
import { SearchBar } from '@/components/ui/search-bar';
import { ContactsTable } from '@/components/contacts/contacts-table';
import { ContactsGrid } from '@/components/contacts/contacts-grid';
import { ContactWithOrganization } from '@/lib/db/supabase-queries';
import { deleteContactAction } from '@/app/app/organizations/[id]/contact-actions';
import MergeDuplicatesDialog from './merge-duplicates-dialog';
import ManualMergeContactsDialog from './manual-merge-dialog';
import { Button } from '@/components/ui/button';
import { GitMerge, X } from 'lucide-react';
import { toast } from 'sonner';

interface ContactsListProps {
  initialContacts: ContactWithOrganization[];
  teamId: number;
}

export default function ContactsList({ initialContacts }: ContactsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState(initialContacts);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);

  const filteredContacts = useMemo(() => {
    if (!searchQuery) return contacts;
    const query = searchQuery.toLowerCase();
    return contacts.filter(
      (contact) =>
        contact.name.toLowerCase().includes(query) ||
        contact.email?.toLowerCase().includes(query) ||
        contact.phone?.toLowerCase().includes(query) ||
        contact.city?.toLowerCase().includes(query) ||
        contact.organization?.name?.toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);

  const handleMerged = (survivorId: number, removedIds: number[]) => {
    setContacts((prev) => prev.filter((c) => !removedIds.includes(c.id)));
    setSelectedIds(new Set());
    setSelectionMode(false);
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
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const selectedContacts = useMemo(
    () => contacts.filter((c) => selectedIds.has(c.id)),
    [contacts, selectedIds]
  );

  return (
    <div className="space-y-6">
      {/* Search + merge — sticky within the scroll container */}
      <div className="flex gap-2 sticky top-0 z-10 bg-background pb-4 -mx-6 lg:-mx-8 px-6 lg:px-8 -mt-6 pt-6">
        <div className="flex-1">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search contacts..."
            className="w-full"
          />
        </div>
        {selectionMode ? (
          <>
            <Button variant="outline" size="sm" onClick={handleCancelSelection} className="flex-shrink-0">
              <X className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Cancel</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setMergeDialogOpen(true)}
              disabled={selectedIds.size < 2}
              className="flex-shrink-0"
            >
              <GitMerge className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Merge {selectedIds.size > 0 ? selectedIds.size : ''} selected</span>
              <span className="sm:hidden">{selectedIds.size > 0 ? selectedIds.size : ''}</span>
            </Button>
          </>
        ) : (
          <>
            <MergeDuplicatesDialog contacts={contacts} onMerged={handleMerged} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectionMode(true)}
              className="flex-shrink-0 border-border hover:bg-accent hover:border-foreground/20 transition-all duration-150"
            >
              <GitMerge className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Select to merge</span>
            </Button>
          </>
        )}
      </div>

      {selectionMode && (
        <p className="text-sm text-muted-foreground -mt-2">
          Select 2 or more contacts to merge them. {selectedIds.size > 0 && `${selectedIds.size} selected.`}
        </p>
      )}

      {/* Results count */}
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
    </div>
  );
}
