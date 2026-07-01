'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { UserCircle, MoreHorizontal, Eye, Trash2, Building2, Check, ExternalLink } from 'lucide-react';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ContactWithOrganization } from '@/lib/db/supabase-queries';
import { InlineEditField } from '@/app/app/organizations/[id]/inline-edit-field';
import { updateContactAction } from '@/app/app/organizations/[id]/contact-actions';
import { toast } from 'sonner';

const ENGAGEMENT_LEVEL_LABELS: Record<string, { label: string; variant: 'outline' | 'secondary' | 'default' | 'destructive' }> = {
  potential: { label: 'Potential', variant: 'outline' },
  learner: { label: 'Learner', variant: 'secondary' },
  participator: { label: 'Participator', variant: 'secondary' },
  attender: { label: 'Attender', variant: 'default' },
  activist: { label: 'Activist', variant: 'default' },
};

const CONTACT_METHOD_LABELS: Record<string, string> = {
  custom_email: 'Custom email',
  email_newsletter: 'Email newsletter',
  custom_text: 'Custom text',
  whatsapp: 'WhatsApp',
};

interface Category {
  id: number;
  name: string;
  color: string;
}

interface ContactsTableProps {
  contacts: ContactWithOrganization[];
  onDelete?: (contact: ContactWithOrganization) => void;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
  categories?: Category[];
  assignmentMap?: Record<number, number[]>;
}

function ContactQuickView({
  contact,
  open,
  onOpenChange,
  categories,
  assignmentMap,
}: {
  contact: ContactWithOrganization | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: Category[];
  assignmentMap: Record<number, number[]>;
}) {
  const router = useRouter();
  const [optimistic, setOptimistic] = React.useState<any>(contact);

  React.useEffect(() => {
    setOptimistic(contact);
  }, [contact]);

  if (!contact || !optimistic) return null;

  const contactCatIds = new Set(assignmentMap[contact.id] || []);
  const contactCategories = categories.filter((cat) => contactCatIds.has(cat.id));
  const level = optimistic.engagement_level ?? 'potential';
  const levelMeta = ENGAGEMENT_LEVEL_LABELS[level] ?? { label: level, variant: 'outline' as const };

  const handleSave = async (field: string, value: string) => {
    const prev = optimistic[field];
    setOptimistic((o: any) => ({ ...o, [field]: value }));
    const result = await updateContactAction({
      id: contact.id,
      organizationId: contact.organization_id || 0,
      [field]: value || undefined,
    });
    if ('error' in result && result.error) {
      setOptimistic((o: any) => ({ ...o, [field]: prev }));
      toast.error(result.error);
      throw new Error(result.error);
    }
    toast.success('Saved');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-2">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
              <UserCircle className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg leading-tight">{optimistic.name}</SheetTitle>
              {contact.organization && (
                <a
                  href={`/app/organizations/${contact.organization.id}`}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mt-0.5"
                >
                  <Building2 className="h-3 w-3" />
                  {contact.organization.name}
                </a>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-1 pt-2">
          <InlineEditField
            label="Name"
            value={optimistic.name || ''}
            onSave={(v) => handleSave('name', v)}
            placeholder="Enter name"
          />
          <InlineEditField
            label="Email"
            value={optimistic.email || ''}
            onSave={(v) => handleSave('email', v)}
            placeholder="email@example.com"
          />
          <InlineEditField
            label="Secondary email"
            value={optimistic.email_secondary || ''}
            onSave={(v) => handleSave('email_secondary', v)}
            placeholder="secondary@example.com"
          />
          <InlineEditField
            label="Phone"
            value={optimistic.phone || ''}
            onSave={(v) => handleSave('phone', v)}
            placeholder="Enter phone number"
          />
          <InlineEditField
            label="Secondary phone"
            value={optimistic.phone_secondary || ''}
            onSave={(v) => handleSave('phone_secondary', v)}
            placeholder="Enter secondary phone"
          />
          <InlineEditField
            label="City"
            value={optimistic.city || ''}
            onSave={(v) => handleSave('city', v)}
            placeholder="Enter city"
          />
          <InlineEditField
            label="State"
            value={optimistic.state || ''}
            onSave={(v) => handleSave('state', v)}
            placeholder="Enter state"
          />
          <InlineEditField
            label="Engagement level"
            value={optimistic.engagement_level || 'potential'}
            onSave={(v) => handleSave('engagement_level', v)}
            type="select"
            options={[
              { value: 'potential', label: 'Potential (Level 0)' },
              { value: 'learner', label: 'Learner (Level 1)' },
              { value: 'participator', label: 'Participator (Level 2)' },
              { value: 'attender', label: 'Attender (Level 3)' },
              { value: 'activist', label: 'Activist (Level 4)' },
            ]}
          />
          <InlineEditField
            label="Background"
            value={optimistic.background || ''}
            onSave={(v) => handleSave('background', v)}
            placeholder="Add background notes…"
            type="textarea"
          />
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 pt-3">
          <Badge variant={levelMeta.variant}>{levelMeta.label}</Badge>
          {optimistic.action_committed && (
            <Badge variant="secondary" className="gap-1">
              <Check className="h-3 w-3" /> Committed to action
            </Badge>
          )}
          {contactCategories.map((cat) => (
            <Badge key={cat.id} variant="outline" className="text-xs">{cat.name}</Badge>
          ))}
        </div>

        <div className="pt-4 border-t border-border/50 mt-4">
          <Button
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              router.push(`/app/contacts/${contact.id}`);
            }}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open full profile
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ContactsTable({ contacts, onDelete, selectedIds, onToggleSelect, categories = [], assignmentMap = {} }: ContactsTableProps) {
  const router = useRouter();
  const selectionMode = selectedIds !== undefined && onToggleSelect !== undefined;
  const [sortKey, setSortKey] = React.useState<string>('name');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');
  const [quickViewContact, setQuickViewContact] = React.useState<ContactWithOrganization | null>(null);

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
    ...categories.map((cat) => ({
      key: `cat_${cat.id}`,
      label: cat.name,
      sortable: false,
      className: 'text-center w-24',
      headerClassName: 'text-center',
      render: (contact: ContactWithOrganization) => {
        const catIds = assignmentMap[contact.id] || [];
        return catIds.includes(cat.id)
          ? <Check className="h-4 w-4 text-primary mx-auto" />
          : <span className="text-muted-foreground/30 text-xs mx-auto block text-center">—</span>;
      },
    } as Column<ContactWithOrganization>)),
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
              View full profile
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
    <>
      <DataTable
        data={sortedContacts}
        columns={columns}
        onRowClick={selectionMode
          ? (contact) => onToggleSelect!(contact.id)
          : (contact) => setQuickViewContact(contact)
        }
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
        emptyState={emptyState}
      />

      <ContactQuickView
        contact={quickViewContact}
        open={quickViewContact !== null}
        onOpenChange={(v) => { if (!v) setQuickViewContact(null); }}
        categories={categories}
        assignmentMap={assignmentMap}
      />
    </>
  );
}
