'use client';

import { useState, useMemo, useDeferredValue, useTransition } from 'react';
import { SearchBar } from '@/components/ui/search-bar';
import { FilterPanel, FilterGroup } from '@/components/ui/filter-panel';
import { OrganizationStats } from '@/components/organizations/organization-stats';
import { OrganizationsTable } from '@/components/organizations/organizations-table';
import { OrganizationsGrid } from '@/components/organizations/organizations-grid';
import DeleteOrganizationDialog from '../delete-organization-dialog';
import MergeOrgDuplicatesDialog from './merge-duplicates-dialog';
import ManualMergeOrgsDialog from './manual-merge-dialog';
import CleanupAddressesDialog from './cleanup-addresses-dialog';
import DraftMessagesDialog from '@/app/app/contacts/(list)/draft-messages-dialog';
import { Organization, User as UserType } from '@/lib/db/schema';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GitMerge, SlidersHorizontal, X, MapPin, User, Sparkles, MessageSquareText } from 'lucide-react';
import { cn } from '@/lib/utils';

type OrganizationWithRelations = Organization & {
  user: Pick<UserType, 'id' | 'name' | 'email'>;
};

interface TeamMember {
  id: number;
  name: string | null;
  email: string;
}

const ALL_REGIONS = '__all__';

interface OrganizationsListProps {
  initialOrganizations: OrganizationWithRelations[];
  teamId: number;
  teamMembers?: TeamMember[];
  currentUserId?: number | null;
  contacts?: { id: number; name: string }[];
  fullContacts?: any[];
  regionOptions?: string[];
  orgOrganizerMap?: Record<number, number[]>;
  lastOneOnOneMap?: Record<number, string>;
}

export default function OrganizationsList({
  initialOrganizations,
  teamMembers = [],
  currentUserId,
  contacts = [],
  fullContacts = [],
  regionOptions = [],
  orgOrganizerMap = {},
  lastOneOnOneMap = {},
}: OrganizationsListProps) {
  const [organizations, setOrganizations] = useState(initialOrganizations);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [deleteOrganization, setDeleteOrganization] = useState<OrganizationWithRelations | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [regionFilter, setRegionFilter] = useState<string | null>(null);
  const [organizerFilter, setOrganizerFilter] = useState<string | null>(null);
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [, startTransition] = useTransition();

  const handleMerged = (survivorId: number, removedIds: number[]) => {
    setOrganizations((prev) => prev.filter((o) => !removedIds.includes(o.id)));
    setSelectedIds(new Set());
    setSelectionMode(false);
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
    startTransition(() => {
      setSelectionMode(false);
      setSelectedIds(new Set());
    });
  };

  const selectedOrganizations = useMemo(
    () => organizations.filter((o) => selectedIds.has(o.id)),
    [organizations, selectedIds]
  );

  const stats = useMemo(() => {
    const total = initialOrganizations.length;
    const byStatus = (s: string) => organizations.filter((c) => c.status === s).length;
    return {
      total,
      potentialLead:      byStatus('Potential Lead'),
      contactMade:        byStatus('Contact Made'),
      activeMembers:      byStatus('Active Members'),
      startingChurchTeam: byStatus('Starting Church Team'),
      activeChurchTeam:   byStatus('Active Church Team'),
    };
  }, [organizations]);

  const filterGroups: FilterGroup[] = useMemo(() => {
    const uniqueSizes = Array.from(
      new Set(initialOrganizations.map((c) => c.size).filter(Boolean))
    ).sort();

    return [
      {
        key: 'status',
        label: 'Engagement status',
        options: [
          { value: 'Potential Lead',       label: '0) Potential Lead',       count: stats.potentialLead },
          { value: 'Contact Made',         label: '1) Contact Made',         count: stats.contactMade },
          { value: 'Active Members',       label: '2) Active Members',       count: stats.activeMembers },
          { value: 'Starting Church Team', label: '3) Starting Church Team', count: stats.startingChurchTeam },
          { value: 'Active Church Team',   label: '4) Active Church Team',   count: stats.activeChurchTeam },
        ],
        multiple: true,
      },
      {
        key: 'type',
        label: 'Organization type',
        options: [
          'Church', 'Community Group', 'Business', 'Nonprofit', 'School', 'Activism', 'Other',
        ].map((t) => ({
          value: t,
          label: t,
          count: organizations.filter((o) => (o as any).type === t).length,
        })),
        multiple: true,
      },
      {
        key: 'size',
        label: 'Organization size',
        options: uniqueSizes.map((size) => ({
          value: size as string,
          label: size as string,
          count: organizations.filter((c) => c.size === size).length,
        })),
        multiple: true,
      },
    ];
  }, [organizations, stats]);

  const filteredOrganizations = useMemo(() => {
    let filtered = initialOrganizations;

    if (regionFilter) {
      filtered = filtered.filter((o) =>
        (((o as any).regions || []) as string[]).includes(regionFilter)
      );
    }

    if (organizerFilter) {
      const uid = parseInt(organizerFilter);
      filtered = filtered.filter((o) =>
        (orgOrganizerMap[o.id] || []).includes(uid)
      );
    }

    if (deferredSearchQuery) {
      const query = deferredSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (organization) =>
          organization.name.toLowerCase().includes(query) ||
          (organization as any).type?.toLowerCase().includes(query) ||
          (((organization as any).regions || []) as string[]).some((r) => r.toLowerCase().includes(query))
      );
    }

    Object.entries(activeFilters).forEach(([key, values]) => {
      if (values.length === 0) return;
      filtered = filtered.filter((organization) => {
        const organizationValue = organization[key as keyof Organization];
        return values.includes(String(organizationValue));
      });
    });

    return filtered;
  }, [organizations, deferredSearchQuery, activeFilters, regionFilter, organizerFilter, orgOrganizerMap]);

  const contactsForFilteredOrgs = useMemo(() => {
    const orgIds = new Set(filteredOrganizations.map((o) => o.id));
    return fullContacts.filter((c: any) => c.organization_id && orgIds.has(c.organization_id));
  }, [filteredOrganizations, fullContacts]);

  const handleFilterChange = (key: string, values: string[]) => {
    setActiveFilters((prev) => ({ ...prev, [key]: values }));
  };

  const handleClearAllFilters = () => {
    setActiveFilters({});
  };

  const totalActiveFilters = Object.values(activeFilters).flat().length;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 relative sticky top-0 z-10 bg-background pb-4 -mx-6 lg:-mx-8 px-6 lg:px-8 -mt-6 pt-6">
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
            <Select
              value={regionFilter || '__all__'}
              onValueChange={(v) => startTransition(() => setRegionFilter(v === '__all__' ? null : v))}
            >
              <SelectTrigger className="w-auto min-w-[140px] max-w-[200px] h-10 border-border hover:bg-accent hover:border-foreground/20 transition-all duration-150">
                <MapPin className="h-4 w-4 mr-2 flex-shrink-0 opacity-50" />
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
              <Select
                value={organizerFilter || '__all__'}
                onValueChange={(v) => startTransition(() => setOrganizerFilter(v === '__all__' ? null : v))}
              >
                <SelectTrigger className="w-auto min-w-[140px] max-w-[200px] h-10 border-border hover:bg-accent hover:border-foreground/20 transition-all duration-150">
                  <User className="h-4 w-4 mr-2 flex-shrink-0 opacity-50" />
                  <SelectValue placeholder="All organizers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All organizers</SelectItem>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id.toString()}>
                      {m.name || m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0 border-border hover:bg-accent hover:border-foreground/20 transition-all duration-150 h-10"
                >
                  <Sparkles className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">AI message</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setDraftDialogOpen(true)}>
                  <MessageSquareText className="h-4 w-4 mr-2" />
                  Draft for org contacts
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <MergeOrgDuplicatesDialog organizations={organizations} onMerged={handleMerged} />
            <CleanupAddressesDialog />
            <Button
              variant="outline"
              size="sm"
              onClick={() => startTransition(() => setSelectionMode(true))}
              className="flex-shrink-0 border-border hover:bg-accent hover:border-foreground/20 transition-all duration-150"
            >
              <GitMerge className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Select to merge</span>
            </Button>
          </>
        )}
        <div className="flex-1">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search organizations..."
            className="w-full"
          />
        </div>
        <Button
          variant={showFilters ? 'default' : 'outline'}
          size="icon"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex-shrink-0 h-10 w-10 relative',
            totalActiveFilters > 0 && 'ring-2 ring-primary/20'
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {totalActiveFilters > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-medium flex items-center justify-center">
              {totalActiveFilters}
            </span>
          )}
        </Button>

        {showFilters && (
          <>
            <div
              className="fixed inset-0 bg-background/40 backdrop-blur-[2px] z-40 animate-in fade-in duration-200"
              onClick={() => setShowFilters(false)}
            />
            <div
              className={cn(
                'absolute top-full right-0 mt-2 w-full lg:w-80 z-50',
                'rounded-lg border border-border/50 bg-card shadow-lg p-4',
                'animate-in slide-in-from-top-2 fade-in duration-200'
              )}
            >
              <FilterPanel
                groups={filterGroups}
                activeFilters={activeFilters}
                onFilterChange={handleFilterChange}
                onClearAll={handleClearAllFilters}
              />
            </div>
          </>
        )}
      </div>

      {selectionMode && (
        <p className="text-sm text-muted-foreground -mt-2">
          Select 2 or more organizations to merge them. {selectedIds.size > 0 && `${selectedIds.size} selected.`}
        </p>
      )}

      {(searchQuery || totalActiveFilters > 0 || regionFilter || organizerFilter) && (
        <div className="text-sm text-muted-foreground">
          Showing {filteredOrganizations.length} of {organizations.length} organizations
        </div>
      )}

      <div className="lg:hidden">
        <OrganizationsGrid
          organizations={filteredOrganizations}
          onDelete={selectionMode ? undefined : setDeleteOrganization}
          selectedIds={selectionMode ? selectedIds : undefined}
          onToggleSelect={selectionMode ? handleToggleSelect : undefined}
        />
      </div>

      <div className="hidden lg:block">
        <OrganizationsTable
          organizations={filteredOrganizations}
          onDelete={selectionMode ? undefined : setDeleteOrganization}
          selectedIds={selectionMode ? selectedIds : undefined}
          onToggleSelect={selectionMode ? handleToggleSelect : undefined}
          teamMembers={teamMembers}
          contacts={contacts}
          regionOptions={regionOptions}
        />
      </div>

      {deleteOrganization && (
        <DeleteOrganizationDialog
          organization={deleteOrganization}
          contactCount={0}
          open={!!deleteOrganization}
          onOpenChange={(open) => !open && setDeleteOrganization(null)}
        />
      )}

      {mergeDialogOpen && selectedOrganizations.length >= 2 && (
        <ManualMergeOrgsDialog
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          organizations={selectedOrganizations}
          onMerged={handleMerged}
        />
      )}

      <DraftMessagesDialog
        open={draftDialogOpen}
        onOpenChange={setDraftDialogOpen}
        contacts={contactsForFilteredOrgs}
        lastOneOnOneMap={lastOneOnOneMap}
      />
    </div>
  );
}
