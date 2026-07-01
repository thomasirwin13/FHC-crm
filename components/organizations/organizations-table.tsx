'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Building2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { DataTable, Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Organization, User as UserType } from '@/lib/db/schema';
import { cn } from '@/lib/utils';

type OrganizationWithRelations = Organization & {
  user: Pick<UserType, 'id' | 'name' | 'email'>;
};

interface OrganizationsTableProps {
  organizations: OrganizationWithRelations[];
  onDelete?: (organization: OrganizationWithRelations) => void;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
}

const statusColors: Record<string, string> = {
  'Potential Lead':       'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  'Contact Made':         'bg-blue-500/10 text-blue-500 border-blue-500/20',
  'Active Members':       'bg-amber-500/10 text-amber-500 border-amber-500/20',
  'Starting Church Team': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  'Active Church Team':   'bg-green-500/10 text-green-500 border-green-500/20',
};

export function OrganizationsTable({ organizations, onDelete, selectedIds, onToggleSelect }: OrganizationsTableProps) {
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

  const sortedOrganizations = React.useMemo(() => {
    return [...organizations].sort((a, b) => {
      const aValue = a[sortKey as keyof Organization];
      const bValue = b[sortKey as keyof Organization];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      // Handle date strings (from Supabase)
      if (sortKey === 'created_at' && typeof aValue === 'string' && typeof bValue === 'string') {
        const aDate = new Date(aValue).getTime();
        const bDate = new Date(bValue).getTime();
        return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
      }

      return sortDirection === 'asc'
        ? (aValue as any) - (bValue as any)
        : (bValue as any) - (aValue as any);
    });
  }, [organizations, sortKey, sortDirection]);

  const columns: Column<OrganizationWithRelations>[] = [
    ...(selectionMode ? [{
      key: '__select__',
      label: '',
      className: 'w-10',
      headerClassName: 'w-10',
      render: (org: OrganizationWithRelations) => (
        <input
          type="checkbox"
          checked={selectedIds!.has(org.id)}
          onChange={() => onToggleSelect!(org.id)}
          onClick={(e) => e.stopPropagation()}
          className="cursor-pointer h-4 w-4"
        />
      ),
    } as Column<OrganizationWithRelations>] : []),
    {
      key: 'name',
      label: 'Organization',
      sortable: true,
      render: (organization) => (
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-foreground group-hover:text-primary transition-colors">
              {organization.name}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'industry',
      label: 'Industry',
      sortable: false,
      render: (organization) => (
        <span className="text-sm text-foreground/80">
          {organization.industry || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (organization) => (
        <Badge
          variant="outline"
          className={cn(
            'transition-all duration-150',
            statusColors[organization.status as keyof typeof statusColors] || statusColors.Lead
          )}
        >
          {organization.status}
        </Badge>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      sortable: false,
      render: (organization) => (
        <span className="text-sm text-foreground/80">
          {organization.location || '-'}
        </span>
      ),
    },
    {
      key: 'size',
      label: 'Size',
      sortable: false,
      render: (organization) => (
        <span className="text-sm text-muted-foreground">
          {organization.size || '-'}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (organization) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {format(new Date(organization.created_at), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      className: 'w-12',
      render: (organization) => (
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
                router.push(`/app/organizations/${organization.id}`);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              View details
            </DropdownMenuItem>
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(organization);
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
        <Building2 className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No organizations found</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
        Get started by adding your first organization to track opportunities and manage relationships.
      </p>
      <Button onClick={() => router.push('/app/organizations/new')}>
        Add your first organization
      </Button>
    </div>
  );

  return (
    <DataTable
      data={sortedOrganizations}
      columns={columns}
      onRowClick={selectionMode
        ? (org) => onToggleSelect!(org.id)
        : (org) => router.push(`/app/organizations/${org.id}`)
      }
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      emptyState={emptyState}
    />
  );
}
