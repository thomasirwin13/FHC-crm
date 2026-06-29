'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { UserCircle, MoreHorizontal, Eye, Trash2, Building2 } from 'lucide-react';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ContactWithOrganization } from '@/lib/db/supabase-queries';

const ENGAGEMENT_LEVEL_LABELS: Record<string, { label: string; variant: 'outline' | 'secondary' | 'default' | 'destructive' }> = {
  potential: { label: 'Potential', variant: 'outline' },
  learner: { label: 'Learner', variant: 'secondary' },
  participator: { label: 'Participator', variant: 'secondary' },
  attender: { label: 'Attender', variant: 'default' },
  activist: { label: 'Activist', variant: 'default' },
};

interface ContactsTableProps {
  contacts: ContactWithOrganization[];
  onDelete?: (contact: ContactWithOrganization) => void;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
}

export function ContactsTable({ contacts, onDelete, selectedIds, onToggleSelect }: ContactsTableProps) {
  const router = useRouter();
  const selectionMode = selectedIds !== undefined && onToggleSelect !== undefined;
  const [sortKey, setSortKey] = React.useState<string>('name');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedContacts = React.useMemo(() => {
    return [...contacts].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortKey === 'organization') {
        aValue = a.organization?.name || '';
        bValue = b.organization?.name || '';
      } else {
        aValue = a[sortKey as keyof typeof a];
        bValue = b[sortKey as keyof typeof b];
      }

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc'
        ? (aValue as any) - (bValue as any)
        : (bValue as any) - (aValue as any);
    });
  }, [contacts, sortKey, sortDirection]);

  const columns: Column<ContactWithOrganization>[] = [
    ...(selectionMode ? [{
      key: '__select__',
      label: '',
      className: 'w-10',
      headerClassName: 'w-10',
      render: (contact: ContactWithOrganization) => (
        <input
          type="checkbox"
          checked={selectedIds!.has(contact.id)}
          onChange={() => onToggleSelect!(contact.id)}
          onClick={(e) => e.stopPropagation()}
          className="cursor-pointer h-4 w-4"
        />
      ),
    } as Column<ContactWithOrganization>] : []),
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (contact) => (
        <div className="flex items-center gap-3 min-w-[180px]">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <UserCircle className="h-4 w-4 text-primary" />
          </div>
          <span className="font-medium text-foreground group-hover:text-primary transition-colors">
            {contact.name}
          </span>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      sortable: false,
      render: (contact) => (
        <span className="text-sm text-foreground/80">
          {contact.email ? (
            <a
              href={`mailto:${contact.email}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:text-primary transition-colors"
            >
              {contact.email}
            </a>
          ) : (
            '-'
          )}
        </span>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      sortable: false,
      render: (contact) => (
        <span className="text-sm text-foreground/80">
          {contact.phone || '-'}
        </span>
      ),
    },
    {
      key: 'organization',
      label: 'Organization',
      sortable: true,
      render: (contact) => (
        contact.organization ? (
          <a
            href={`/app/organizations/${contact.organization.id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-sm text-foreground/80 hover:text-primary transition-colors"
          >
            <Building2 className="h-3.5 w-3.5" />
            {contact.organization.name}
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )
      ),
    },
    {
      key: 'location',
      label: 'Location',
      sortable: false,
      render: (contact) => (
        <span className="text-sm text-muted-foreground">
          {[contact.city, contact.state].filter(Boolean).join(', ') || '-'}
        </span>
      ),
    },
    {
      key: 'engagement_level',
      label: 'Level',
      sortable: true,
      render: (contact) => {
        const level = (contact as any).engagement_level ?? 'potential';
        const meta = ENGAGEMENT_LEVEL_LABELS[level] ?? { label: level, variant: 'outline' as const };
        return <Badge variant={meta.variant} className="text-xs">{meta.label}</Badge>;
      },
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (contact) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {format(new Date(contact.created_at), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      className: 'w-12',
      render: (contact) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/app/contacts/${contact.id}`);
              }}
            >
              <Eye className="mr-2 h-4 w-4" />
              View details
            </DropdownMenuItem>
            {contact.organization && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/app/organizations/${contact.organization!.id}`);
                }}
              >
                <Building2 className="mr-2 h-4 w-4" />
                View organization
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(contact);
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const emptyState = (
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

  return (
    <DataTable
      data={sortedContacts}
      columns={columns}
      onRowClick={selectionMode
        ? (contact) => onToggleSelect!(contact.id)
        : (contact) => router.push(`/app/contacts/${contact.id}`)
      }
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      emptyState={emptyState}
    />
  );
}
