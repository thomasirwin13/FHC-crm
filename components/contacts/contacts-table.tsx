'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { UserCircle, MoreHorizontal, Eye, Trash2, Building2, Check, ExternalLink, ChevronsUpDown, Plus, X, Tag } from 'lucide-react';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
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
import { updateContactAction, setContactPrimaryOrganizationAction, updateContactRegionsAction } from '@/app/app/organizations/[id]/contact-actions';
import { addContactCategoryAction, removeContactCategoryAction } from '@/app/app/contacts/[id]/category-actions';
import { toast } from 'sonner';

const REGION_OPTIONS = [
  'Antelope Valley',
  'San Fernando Valley',
  'San Gabriel Valley',
  'Metro/Central LA',
  'West LA',
  'South LA',
  'South East LA',
  'South Bay',
  'Orange County',
  'Other',
];

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

interface TeamMember {
  id: number;
  name: string | null;
  email: string;
}

interface ContactsTableProps {
  contacts: ContactWithOrganization[];
  onDelete?: (contact: ContactWithOrganization) => void;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
  categories?: Category[];
  assignmentMap?: Record<number, number[]>;
  teamMembers?: TeamMember[];
  currentUserId?: number | null;
  organizations?: { id: number; name: string }[];
}

export function ContactQuickView({
  contact,
  open,
  onOpenChange,
  categories,
  assignmentMap,
  teamMembers,
  organizations,
}: {
  contact: ContactWithOrganization | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: Category[];
  assignmentMap: Record<number, number[]>;
  teamMembers: TeamMember[];
  organizations: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [optimistic, setOptimistic] = React.useState<any>(contact);
  const [orgComboOpen, setOrgComboOpen] = React.useState(false);
  const [orgSaving, setOrgSaving] = React.useState(false);
  const [tagComboOpen, setTagComboOpen] = React.useState(false);
  const [catIds, setCatIds] = React.useState<Set<number>>(new Set());

  React.useEffect(() => {
    setOptimistic(contact);
    setCatIds(new Set(contact ? assignmentMap[contact.id] || [] : []));
  }, [contact, assignmentMap]);

  if (!contact || !optimistic) return null;

  const contactCategories = categories.filter((cat) => catIds.has(cat.id));

  const handleToggleCategory = async (categoryId: number) => {
    const has = catIds.has(categoryId);
    const next = new Set(catIds);
    if (has) next.delete(categoryId);
    else next.add(categoryId);
    setCatIds(next);
    const result = has
      ? await removeContactCategoryAction(contact.id, categoryId)
      : await addContactCategoryAction(contact.id, categoryId);
    if ('error' in result && result.error) {
      // revert
      setCatIds((prev) => {
        const revert = new Set(prev);
        if (has) revert.add(categoryId);
        else revert.delete(categoryId);
        return revert;
      });
      toast.error(result.error);
    } else {
      toast.success(has ? 'Tag removed' : 'Tag added');
      router.refresh();
    }
  };
  const level = optimistic.engagement_level ?? 'potential';
  const levelMeta = ENGAGEMENT_LEVEL_LABELS[level] ?? { label: level, variant: 'outline' as const };

  const handleSave = async (field: string, value: string) => {
    const prev = optimistic[field];
    const coerced: any = field === 'assigned_user_id'
      ? (value && value !== '__none__' ? parseInt(value, 10) : null)
      : (value || undefined);
    setOptimistic((o: any) => ({ ...o, [field]: coerced }));
    const result = await updateContactAction({
      id: contact.id,
      organizationId: contact.organization_id || 0,
      [field]: coerced,
    });
    if ('error' in result && result.error) {
      setOptimistic((o: any) => ({ ...o, [field]: prev }));
      toast.error(result.error);
      throw new Error(result.error);
    }
    toast.success('Saved');
  };

  const handleOrgChange = async (organizationId: number | null) => {
    if (!contact) return;
    setOrgComboOpen(false);
    const prevOrg = optimistic.organization;
    const prevOrgId = optimistic.organization_id;
    const org = organizationId ? organizations.find((o) => o.id === organizationId) : null;
    // Optimistic update
    setOptimistic((o: any) => ({
      ...o,
      organization_id: organizationId,
      organization: org ? { id: org.id, name: org.name } : null,
    }));
    setOrgSaving(true);
    const result = await setContactPrimaryOrganizationAction(contact.id, organizationId);
    setOrgSaving(false);
    if ('error' in result && result.error) {
      setOptimistic((o: any) => ({ ...o, organization: prevOrg, organization_id: prevOrgId }));
      toast.error(result.error);
    } else {
      toast.success(org ? `Linked to ${org.name}` : 'Organization removed');
      router.refresh();
    }
  };

  const currentOrgId: number | null = optimistic?.organization?.id ?? optimistic?.organization_id ?? null;

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
          <div className="space-y-1 pt-1">
            <Label className="text-xs font-medium text-muted-foreground">Organization</Label>
            <Popover open={orgComboOpen} onOpenChange={setOrgComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={orgComboOpen}
                  disabled={orgSaving}
                  className="w-full justify-between font-normal h-9"
                >
                  {currentOrgId
                    ? (organizations.find((o) => o.id === currentOrgId)?.name
                        ?? optimistic?.organization?.name
                        ?? 'Unknown organization')
                    : <span className="text-muted-foreground">No organization</span>}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search organizations…" />
                  <CommandList>
                    <CommandEmpty>No organizations found.</CommandEmpty>
                    <CommandGroup>
                      {currentOrgId && (
                        <CommandItem
                          value="__none__"
                          onSelect={() => handleOrgChange(null)}
                        >
                          <Check className="mr-2 h-4 w-4 opacity-0" />
                          <span className="text-muted-foreground">No organization</span>
                        </CommandItem>
                      )}
                      {organizations.map((org) => (
                        <CommandItem
                          key={org.id}
                          value={org.name}
                          onSelect={() => handleOrgChange(org.id)}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              currentOrgId === org.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          {org.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
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

          {/* Region multi-select */}
          <div className="space-y-1 group">
            <Label className="text-xs font-medium text-muted-foreground">Region</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal h-auto min-h-9 py-1.5"
                >
                  <span className="flex flex-wrap gap-1 text-left">
                    {((optimistic as any).regions || []).length === 0 ? (
                      <span className="text-muted-foreground">Select region(s)</span>
                    ) : (
                      ((optimistic as any).regions as string[]).map((r: string) => (
                        <span key={r} className="inline-flex items-center rounded bg-primary/10 text-primary px-1.5 py-0.5 text-xs">
                          {r}
                        </span>
                      ))
                    )}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandList>
                    <CommandGroup>
                      {(() => {
                        const cur = ((optimistic as any).regions || []) as string[];
                        const allSelected = cur.length === REGION_OPTIONS.length;
                        return (
                          <CommandItem
                            value="__all__"
                            onSelect={async () => {
                              const next = allSelected ? [] : [...REGION_OPTIONS];
                              setOptimistic((o: any) => ({ ...o, regions: next }));
                              const result = await updateContactRegionsAction(contact.id, next);
                              if ('error' in result && result.error) {
                                setOptimistic((o: any) => ({ ...o, regions: cur }));
                                toast.error(result.error);
                              } else {
                                toast.success('Region updated');
                              }
                            }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', allSelected ? 'opacity-100' : 'opacity-0')} />
                            <span className="font-medium">All</span>
                          </CommandItem>
                        );
                      })()}
                      {REGION_OPTIONS.map((region) => {
                        const cur = ((optimistic as any).regions || []) as string[];
                        const selected = cur.includes(region);
                        return (
                          <CommandItem
                            key={region}
                            value={region}
                            onSelect={async () => {
                              const next = selected ? cur.filter((r: string) => r !== region) : [...cur, region];
                              setOptimistic((o: any) => ({ ...o, regions: next }));
                              const result = await updateContactRegionsAction(contact.id, next);
                              if ('error' in result && result.error) {
                                setOptimistic((o: any) => ({ ...o, regions: cur }));
                                toast.error(result.error);
                              } else {
                                toast.success('Region updated');
                              }
                            }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', selected ? 'opacity-100' : 'opacity-0')} />
                            {region}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
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
          {teamMembers.length > 0 && (
            <InlineEditField
              label="Lead organizer"
              value={optimistic.assigned_user_id?.toString() || ''}
              onSave={(v) => handleSave('assigned_user_id', v)}
              type="select"
              options={[
                { value: '__none__', label: 'Unassigned' },
                ...teamMembers.map((m) => ({
                  value: m.id.toString(),
                  label: m.name || m.email,
                })),
              ]}
              placeholder="Assign organizer"
            />
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 pt-3">
          <Badge variant={levelMeta.variant}>{levelMeta.label}</Badge>
          {optimistic.action_committed && (
            <Badge variant="secondary" className="gap-1">
              <Check className="h-3 w-3" /> Committed to action
            </Badge>
          )}
        </div>

        {/* Tags */}
        <div className="space-y-1.5 pt-3">
          <Label className="text-xs font-medium text-muted-foreground">Tags</Label>
          <div className="flex flex-wrap items-center gap-1.5">
            {contactCategories.map((cat) => (
              <span
                key={cat.id}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs"
              >
                {cat.name}
                <button
                  type="button"
                  onClick={() => handleToggleCategory(cat.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <Popover open={tagComboOpen} onOpenChange={setTagComboOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs">
                  <Plus className="h-3 w-3" /> Add tag
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search tags…" />
                  <CommandList>
                    <CommandEmpty>No tags found.</CommandEmpty>
                    <CommandGroup>
                      {categories.map((cat) => (
                        <CommandItem
                          key={cat.id}
                          value={cat.name}
                          onSelect={() => handleToggleCategory(cat.id)}
                        >
                          <Check className={cn('mr-2 h-4 w-4', catIds.has(cat.id) ? 'opacity-100' : 'opacity-0')} />
                          {cat.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
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

export function ContactsTable({ contacts, onDelete, selectedIds, onToggleSelect, categories = [], assignmentMap = {}, teamMembers = [], organizations = [] }: ContactsTableProps) {
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
      key: 'regions',
      label: 'Region',
      sortable: false,
      render: (contact) => {
        const regions = ((contact as any).regions || []) as string[];
        return regions.length ? (
          <div className="flex flex-wrap gap-1">
            {regions.map((r) => (
              <span key={r} className="inline-flex items-center rounded bg-primary/10 text-primary px-1.5 py-0.5 text-xs">
                {r}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        );
      },
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
        teamMembers={teamMembers}
        organizations={organizations}
      />
    </>
  );
}
