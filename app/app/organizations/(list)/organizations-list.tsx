'use client';

import { useState, useMemo } from 'react';
import { SearchBar } from '@/components/ui/search-bar';
import { FilterPanel, FilterGroup } from '@/components/ui/filter-panel';
import { OrganizationStats } from '@/components/organizations/organization-stats';
import { OrganizationsTable } from '@/components/organizations/organizations-table';
import { OrganizationsGrid } from '@/components/organizations/organizations-grid';
import DeleteOrganizationDialog from '../delete-organization-dialog';
import MergeOrgDuplicatesDialog from './merge-duplicates-dialog';
import ManualMergeOrgsDialog from './manual-merge-dialog';
import { Organization, User as UserType } from '@/lib/db/schema';
import { Button } from '@/components/ui/button';
import { GitMerge, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type OrganizationWithRelations = Organization & {
  user: Pick<UserType, 'id' | 'name' | 'email'>;
};

interface OrganizationsListProps {
  initialOrganizations: OrganizationWithRelations[];
  teamId: number;
}

export default function OrganizationsList({ initialOrganizations }: OrganizationsListProps) {
  const [organizations, setOrganizations] = useState(initialOrganizations);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [deleteOrganization, setDeleteOrganization] = useState<OrganizationWithRelations | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);

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
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const selectedOrganizations = useMemo(
    () => organizations.filter((o) => selectedIds.has(o.id)),
    [organizations, selectedIds]
  );

  // Calculate stats
  const stats = useMemo(() => {
    const total = initialOrganizations.length;
    const leads = organizations.filter((c) => c.status === 'Lead').length;
    const opportunities = organizations.filter((c) => c.status === 'Opportunity').length;
    const clients = organizations.filter((c) => c.status === 'Client').length;
    const churned = organizations.filter((c) => c.status === 'Churned').length;
    const closedLost = organizations.filter((c) => c.status === 'Closed Lost').length;
    return { total, leads, opportunities, clients, churned, closedLost };
  }, [organizations]);

  // Get unique industries and sizes for filters
  const filterGroups: FilterGroup[] = useMemo(() => {
    const uniqueIndustries = Array.from(
      new Set(initialOrganizations.map((c) => c.industry).filter(Boolean))
    ).sort();
    const uniqueSizes = Array.from(
      new Set(initialOrganizations.map((c) => c.size).filter(Boolean))
    ).sort();

    return [
      {
        key: 'status',
        label: 'Status',
        options: [
          {
            value: 'Lead',
            label: 'Lead',
            count: stats.leads,
          },
          {
            value: 'Opportunity',
            label: 'Opportunity',
            count: stats.opportunities,
          },
          {
            value: 'Client',
            label: 'Client',
            count: stats.clients,
          },
          {
            value: 'Churned',
            label: 'Churned',
            count: stats.churned,
          },
          {
            value: 'Closed Lost',
            label: 'Closed Lost',
            count: stats.closedLost,
          },
        ],
        multiple: true,
      },
      {
        key: 'industry',
        label: 'Industry',
        options: uniqueIndustries.map((industry) => ({
          value: industry as string,
          label: industry as string,
          count: organizations.filter((c) => c.industry === industry).length,
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

  // Filter organizations based on search and filters
  const filteredOrganizations = useMemo(() => {
    let filtered = initialOrganizations;

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (organization) =>
          organization.name.toLowerCase().includes(query) ||
          organization.industry?.toLowerCase().includes(query) ||
          organization.location?.toLowerCase().includes(query)
      );
    }

    // Apply filters
    Object.entries(activeFilters).forEach(([key, values]) => {
      if (values.length > 0) {
        filtered = filtered.filter((organization) => {
          const organizationValue = organization[key as keyof Organization];
          return values.includes(String(organizationValue));
        });
      }
    });

    return filtered;
  }, [organizations, searchQuery, activeFilters]);

  const handleFilterChange = (key: string, values: string[]) => {
    setActiveFilters((prev) => ({
      ...prev,
      [key]: values,
    }));
  };

  const handleClearAllFilters = () => {
    setActiveFilters({});
  };

  const totalActiveFilters = Object.values(activeFilters).flat().length;

  return (
    <div className="space-y-6">


      {/* Search and Filters — sticky within the scroll container */}
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
            <MergeOrgDuplicatesDialog organizations={organizations} onMerged={handleMerged} />
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

        {/* Filter Panel Overlay */}
        {showFilters && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-background/40 backdrop-blur-[2px] z-40 animate-in fade-in duration-200"
              onClick={() => setShowFilters(false)}
            />
            {/* Panel */}
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

      {/* Results count */}
      {(searchQuery || totalActiveFilters > 0) && (
        <div className="text-sm text-muted-foreground">
          Showing {filteredOrganizations.length} of {organizations.length} organizations
        </div>
      )}

      {/* Mobile: Card Grid */}
      <div className="lg:hidden">
        <OrganizationsGrid
          organizations={filteredOrganizations}
          onDelete={selectionMode ? undefined : setDeleteOrganization}
          selectedIds={selectionMode ? selectedIds : undefined}
          onToggleSelect={selectionMode ? handleToggleSelect : undefined}
        />
      </div>

      {/* Desktop: Table */}
      <div className="hidden lg:block">
        <OrganizationsTable
          organizations={filteredOrganizations}
          onDelete={selectionMode ? undefined : setDeleteOrganization}
          selectedIds={selectionMode ? selectedIds : undefined}
          onToggleSelect={selectionMode ? handleToggleSelect : undefined}
        />
      </div>

      {/* Delete Dialog */}
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
    </div>
  );
}
