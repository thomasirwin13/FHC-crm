'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Building2, MoreHorizontal, Pencil, Trash2, ExternalLink, Globe, Flag, UserPlus, Check, ChevronsUpDown } from 'lucide-react';
import { DataTable, Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Organization, User as UserType } from '@/lib/db/schema';
import { cn } from '@/lib/utils';
import { InlineEditField } from '@/app/app/organizations/[id]/inline-edit-field';
import { updateOrganizationAction, updateOrganizationRegionsAction } from '@/app/app/organizations/[id]/actions';
import { linkContactToOrganizationAction } from '@/app/app/organizations/[id]/contact-actions';
import { toast } from 'sonner';

type OrganizationWithRelations = Organization & {
  user: Pick<UserType, 'id' | 'name' | 'email'>;
};

interface TeamMember {
  id: number;
  name: string | null;
  email: string;
}

interface OrganizationsTableProps {
  organizations: OrganizationWithRelations[];
  onDelete?: (organization: OrganizationWithRelations) => void;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
  teamMembers?: TeamMember[];
  contacts?: { id: number; name: string }[];
}

const statusColors: Record<string, string> = {
  'Potential Lead':       'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  'Contact Made':         'bg-blue-500/10 text-blue-500 border-blue-500/20',
  'Active Members':       'bg-amber-500/10 text-amber-500 border-amber-500/20',
  'Starting Church Team': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  'Active Church Team':   'bg-green-500/10 text-green-500 border-green-500/20',
};

const STATUS_LABELS: Record<string, string> = {
  'Potential Lead':       '0) Potential Lead',
  'Contact Made':         '1) Contact Made',
  'Active Members':       '2) Active Members',
  'Starting Church Team': '3) Starting Church Team',
  'Active Church Team':   '4) Active Church Team',
};
const fmtStatus = (s: string) => STATUS_LABELS[s] ?? s;

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

const ENGAGEMENT_STATUSES = [
  { value: 'Potential Lead',       label: '0) Potential Lead' },
  { value: 'Contact Made',         label: '1) Contact Made' },
  { value: 'Active Members',       label: '2) Active Members' },
  { value: 'Starting Church Team', label: '3) Starting Church Team' },
  { value: 'Active Church Team',   label: '4) Active Church Team' },
];

function OrgQuickView({
  org,
  open,
  onOpenChange,
  teamMembers,
  contacts,
}: {
  org: OrganizationWithRelations | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  teamMembers: TeamMember[];
  contacts: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [optimistic, setOptimistic] = React.useState<any>(org);
  const [contactComboOpen, setContactComboOpen] = React.useState(false);
  const [linking, setLinking] = React.useState(false);
  const [linkedNames, setLinkedNames] = React.useState<string[]>([]);
  const [linkedIds, setLinkedIds] = React.useState<Set<number>>(new Set());

  React.useEffect(() => {
    setOptimistic(org);
    setLinkedNames([]);
    setLinkedIds(new Set());
  }, [org]);

  if (!org || !optimistic) return null;

  const handleLinkContact = async (contactId: number, contactName: string) => {
    setContactComboOpen(false);
    setLinking(true);
    const result = await linkContactToOrganizationAction(contactId, org.id);
    setLinking(false);
    if ('error' in result && result.error) {
      toast.error(result.error);
      return;
    }
    setLinkedIds((prev) => new Set(prev).add(contactId));
    setLinkedNames((prev) => (prev.includes(contactName) ? prev : [...prev, contactName]));
    toast.success((result as any).alreadyLinked ? `${contactName} is already linked` : `Linked ${contactName}`);
    router.refresh();
  };

  const availableContacts = contacts.filter((c) => !linkedIds.has(c.id));

  const handleSave = async (field: string, value: string) => {
    const prev = optimistic[field];
    setOptimistic((o: any) => ({ ...o, [field]: value }));

    const formData = new FormData();
    formData.append('id', org.id.toString());
    formData.append('name',        field === 'name'        ? value : optimistic.name);
    formData.append('website',     field === 'website'     ? value : (optimistic.website || ''));
    formData.append('type',        field === 'type'        ? value : (optimistic.type || ''));
    formData.append('description', field === 'description' ? value : (optimistic.description || ''));
    formData.append('size',        field === 'size'        ? value : (optimistic.size || ''));
    formData.append('status',      field === 'status'      ? value : (optimistic.status || 'Potential Lead'));
    const rawAssigned = field === 'assigned_user_id' ? value : (optimistic.assigned_user_id?.toString() || '');
    const assignedVal = rawAssigned === '__none__' ? '' : rawAssigned;
    if (assignedVal) formData.append('assigned_user_id', assignedVal);
    formData.append('priority_follow_up', String(optimistic.priority_follow_up ?? false));

    const result = await updateOrganizationAction({}, formData);
    if ('error' in result && result.error) {
      setOptimistic((o: any) => ({ ...o, [field]: prev }));
      toast.error(result.error);
    } else {
      toast.success('Saved');
    }
  };

  const handleTogglePriority = async () => {
    const next = !optimistic.priority_follow_up;
    setOptimistic((o: any) => ({ ...o, priority_follow_up: next }));
    const formData = new FormData();
    formData.append('id', org.id.toString());
    formData.append('name', optimistic.name);
    formData.append('website', optimistic.website || '');
    formData.append('type', optimistic.type || '');
    formData.append('description', optimistic.description || '');
    formData.append('size', optimistic.size || '');
    formData.append('status', optimistic.status || 'Potential Lead');
    formData.append('priority_follow_up', String(next));
    const result = await updateOrganizationAction({}, formData);
    if ('error' in result && result.error) {
      setOptimistic((o: any) => ({ ...o, priority_follow_up: !next }));
      toast.error(result.error);
    } else {
      toast.success(next ? 'Marked as priority' : 'Removed priority flag');
    }
  };

  const status = optimistic.status || 'Potential Lead';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-2">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg leading-tight">{optimistic.name}</SheetTitle>
              <Badge
                variant="outline"
                className={cn('mt-1 text-xs', statusColors[status] || statusColors['Potential Lead'])}
              >
                {fmtStatus(status)}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-1 pt-2">
          <InlineEditField
            label="Organization name"
            value={optimistic.name || ''}
            onSave={(v) => handleSave('name', v)}
            placeholder="Enter name"
          />
          <InlineEditField
            label="Engagement status"
            value={optimistic.status || 'Potential Lead'}
            onSave={(v) => handleSave('status', v)}
            type="select"
            options={ENGAGEMENT_STATUSES}
            placeholder="Select status"
          />
          <InlineEditField
            label="Organization type"
            value={optimistic.type || ''}
            onSave={(v) => handleSave('type', v)}
            type="select"
            options={[
              { value: 'Church', label: 'Church' },
              { value: 'Community Group', label: 'Community group' },
              { value: 'Business', label: 'Business' },
              { value: 'Nonprofit', label: 'Nonprofit' },
              { value: 'School', label: 'School' },
              { value: 'Activism', label: 'Activism' },
              { value: 'Other', label: 'Other' },
            ]}
            placeholder="Select type"
          />
          <InlineEditField
            label="Website"
            value={optimistic.website || ''}
            onSave={(v) => handleSave('website', v)}
            placeholder="https://example.com"
          />
          <InlineEditField
            label="Size"
            value={optimistic.size || ''}
            onSave={(v) => handleSave('size', v)}
            placeholder="e.g. 1-10, 50-100"
          />
          <InlineEditField
            label="Description"
            value={optimistic.description || ''}
            onSave={(v) => handleSave('description', v)}
            placeholder="Add a description…"
            type="textarea"
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
                    {(optimistic.regions || []).length === 0 ? (
                      <span className="text-muted-foreground">Select region(s)</span>
                    ) : (
                      (optimistic.regions as string[]).map((r: string) => (
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
                        const cur = (optimistic.regions || []) as string[];
                        const allSelected = cur.length === REGION_OPTIONS.length;
                        return (
                          <CommandItem
                            value="__all__"
                            onSelect={async () => {
                              const next = allSelected ? [] : [...REGION_OPTIONS];
                              setOptimistic((o: any) => ({ ...o, regions: next }));
                              const result = await updateOrganizationRegionsAction(org.id, next);
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
                        const cur = (optimistic.regions || []) as string[];
                        const selected = cur.includes(region);
                        return (
                          <CommandItem
                            key={region}
                            value={region}
                            onSelect={async () => {
                              const next = selected ? cur.filter((r: string) => r !== region) : [...cur, region];
                              setOptimistic((o: any) => ({ ...o, regions: next }));
                              const result = await updateOrganizationRegionsAction(org.id, next);
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

        {/* Link a contact */}
        <div className="space-y-1.5 pt-3">
          <Label className="text-xs font-medium text-muted-foreground">Link a contact</Label>
          <Popover open={contactComboOpen} onOpenChange={setContactComboOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={contactComboOpen}
                disabled={linking || contacts.length === 0}
                className="w-full justify-between font-normal h-9"
              >
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <UserPlus className="h-4 w-4" />
                  {contacts.length === 0 ? 'No contacts available' : 'Add a contact to this organization'}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search contacts…" />
                <CommandList>
                  <CommandEmpty>No contacts found.</CommandEmpty>
                  <CommandGroup>
                    {availableContacts.map((c) => (
                      <CommandItem key={c.id} value={c.name} onSelect={() => handleLinkContact(c.id, c.name)}>
                        <UserPlus className="mr-2 h-4 w-4 opacity-50" />
                        {c.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {linkedNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {linkedNames.map((name) => (
                <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                  <Check className="h-3 w-3" /> {name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="flex flex-wrap gap-2 pt-3">
          {optimistic.website && (
            <a
              href={optimistic.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
              onClick={(e) => e.stopPropagation()}
            >
              <Globe className="h-3 w-3" /> Website
            </a>
          )}
        </div>

        {/* Priority follow up toggle */}
        <button
          onClick={handleTogglePriority}
          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-md border text-sm font-medium transition-colors mt-3 ${
            optimistic.priority_follow_up
              ? 'border-red-500/40 bg-red-500/10 text-red-500'
              : 'border-border/50 text-muted-foreground hover:bg-muted/40'
          }`}
        >
          <Flag className="h-4 w-4 flex-shrink-0" />
          {optimistic.priority_follow_up ? 'Priority follow up (on)' : 'Mark as priority follow up'}
        </button>

        <div className="pt-4 border-t border-border/50 mt-4">
          <Button
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              router.push(`/app/organizations/${org.id}`);
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

export function OrganizationsTable({ organizations, onDelete, selectedIds, onToggleSelect, teamMembers = [], contacts = [] }: OrganizationsTableProps) {
  const router = useRouter();
  const selectionMode = selectedIds !== undefined && onToggleSelect !== undefined;
  const [sortKey, setSortKey] = React.useState<string>('name');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');
  const [quickViewOrg, setQuickViewOrg] = React.useState<OrganizationWithRelations | null>(null);

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

      if (sortKey === 'created_at' && typeof aValue === 'string' && typeof bValue === 'string') {
        const aDate = new Date(aValue).getTime();
        const bDate = new Date(bValue).getTime();
        return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
      }

      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        return sortDirection === 'asc'
          ? (aValue === bValue ? 0 : aValue ? -1 : 1)
          : (aValue === bValue ? 0 : aValue ? 1 : -1);
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
          <span className="font-medium text-foreground group-hover:text-primary transition-colors">
            {organization.name}
          </span>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Organization type',
      sortable: false,
      render: (organization) => (
        <span className="text-sm text-foreground/80">{(organization as any).type || '-'}</span>
      ),
    },
    {
      key: 'status',
      label: 'Engagement status',
      sortable: true,
      render: (organization) => (
        <Badge
          variant="outline"
          className={cn('transition-all duration-150', statusColors[organization.status as string] || statusColors['Potential Lead'])}
        >
          {fmtStatus(organization.status as string)}
        </Badge>
      ),
    },
    {
      key: 'regions',
      label: 'Region',
      sortable: false,
      render: (organization) => {
        const regions = ((organization as any).regions || []) as string[];
        return regions.length ? (
          <span className="flex flex-wrap gap-1">
            {regions.map((r) => (
              <span key={r} className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-xs text-foreground/80">
                {r}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-sm text-foreground/80">-</span>
        );
      },
    },
    {
      key: 'size',
      label: 'Size',
      sortable: false,
      render: (organization) => (
        <span className="text-sm text-muted-foreground">{organization.size || '-'}</span>
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
      key: 'priority_follow_up',
      label: 'Priority',
      sortable: true,
      headerClassName: 'w-24',
      className: 'w-24',
      render: (organization) => (
        (organization as any).priority_follow_up
          ? <Flag className="h-4 w-4 text-red-500" />
          : <span className="text-muted-foreground/30 text-sm">—</span>
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
              View full profile
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
    <>
      <DataTable
        data={sortedOrganizations}
        columns={columns}
        onRowClick={selectionMode
          ? (org) => onToggleSelect!(org.id)
          : (org) => setQuickViewOrg(org)
        }
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
        emptyState={emptyState}
      />

      <OrgQuickView
        org={quickViewOrg}
        open={quickViewOrg !== null}
        onOpenChange={(v) => { if (!v) setQuickViewOrg(null); }}
        teamMembers={teamMembers}
        contacts={contacts}
      />
    </>
  );
}
