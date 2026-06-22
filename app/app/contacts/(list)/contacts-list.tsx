'use client';

import { useState, useMemo } from 'react';
import { SearchBar } from '@/components/ui/search-bar';
import { ContactsTable } from '@/components/contacts/contacts-table';
import { ContactsGrid } from '@/components/contacts/contacts-grid';
import { ContactWithOrganization } from '@/lib/db/supabase-queries';
import { deleteContactAction } from '@/app/app/organizations/[id]/contact-actions';
import MergeDuplicatesDialog from './merge-duplicates-dialog';
import { toast } from 'sonner';

interface ContactsListProps {
  initialContacts: ContactWithOrganization[];
  teamId: number;
}

export default function ContactsList({ initialContacts }: ContactsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState(initialContacts);

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

  return (
    <div className="space-y-6">
      {/* Search + merge */}
      <div className="flex gap-2">
        <div className="flex-1">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search contacts..."
            className="w-full"
          />
        </div>
        <MergeDuplicatesDialog contacts={contacts} onMerged={handleMerged} />
      </div>

      {/* Results count */}
      {searchQuery && (
        <div className="text-sm text-muted-foreground">
          Showing {filteredContacts.length} of {contacts.length} contacts
        </div>
      )}

      {/* Mobile: Card Grid */}
      <div className="lg:hidden">
        <ContactsGrid contacts={filteredContacts} onDelete={handleDelete} />
      </div>

      {/* Desktop: Table */}
      <div className="hidden lg:block">
        <ContactsTable contacts={filteredContacts} onDelete={handleDelete} />
      </div>
    </div>
  );
}
