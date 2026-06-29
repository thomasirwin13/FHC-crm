'use client';

import { useRouter } from 'next/navigation';
import { UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContactCard } from './contact-card';
import { ContactWithOrganization } from '@/lib/db/supabase-queries';

interface ContactsGridProps {
  contacts: ContactWithOrganization[];
  onDelete?: (contact: ContactWithOrganization) => void;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
}

export function ContactsGrid({ contacts, onDelete, selectedIds, onToggleSelect }: ContactsGridProps) {
  const router = useRouter();

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="rounded-full bg-muted p-6 mb-4">
          <UserCircle className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No contacts found</h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
          Get started by adding your first contact.
        </p>
        <Button onClick={() => router.push('/app/contacts/new')}>
          Add your first contact
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {contacts.map((contact) => (
        <ContactCard
          key={contact.id}
          contact={contact}
          onDelete={onDelete}
          selected={selectedIds?.has(contact.id)}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}
