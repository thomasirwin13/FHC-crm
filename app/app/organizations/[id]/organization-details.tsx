'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Organization } from '@/lib/db/schema';
import { InlineEditField } from './inline-edit-field';
import { updateOrganizationAction, updateOrganizationRegionsAction, updateOrganizationAddressAction } from './actions';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import SuggestDetailsButton from './suggest-details-button';

const DEFAULT_REGION_OPTIONS: string[] = [];

function RegionMultiSelect({
  value,
  onChange,
  options,
}: {
  value: string[];
  onChange: (regions: string[]) => void;
  options: string[];
}) {
  const [open, setOpen] = useState(false);

  const toggle = (region: string) => {
    onChange(
      value.includes(region) ? value.filter((r) => r !== region) : [...value, region]
    );
  };

  return (
    <div className="space-y-1 group">
      <Label className="text-xs font-medium text-muted-foreground">Region</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal h-auto min-h-9 py-1.5"
          >
            <span className="flex flex-wrap gap-1 text-left">
              {value.length === 0 ? (
                <span className="text-muted-foreground">Select region(s)</span>
              ) : (
                value.map((r) => (
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
                  const allSelected = value.length === options.length;
                  return (
                    <CommandItem
                      value="__all__"
                      onSelect={() => onChange(allSelected ? [] : [...options])}
                    >
                      <Check className={cn('mr-2 h-4 w-4', allSelected ? 'opacity-100' : 'opacity-0')} />
                      <span className="font-medium">All</span>
                    </CommandItem>
                  );
                })()}
                {options.map((region) => {
                  const selected = value.includes(region);
                  return (
                    <CommandItem key={region} value={region} onSelect={() => toggle(region)}>
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
  );
}

const ORG_TYPE_OPTIONS = [
  { value: 'Church', label: 'Church' },
  { value: 'Community Group', label: 'Community group' },
  { value: 'Business', label: 'Business' },
  { value: 'Nonprofit', label: 'Nonprofit' },
  { value: 'School', label: 'School' },
  { value: 'Activism', label: 'Activism' },
  { value: 'Other', label: 'Other' },
];

const ENGAGEMENT_STATUSES = [
  { value: 'Potential Lead', label: '0) Potential Lead' },
  { value: 'Contact Made', label: '1) Contact Made' },
  { value: 'Active Members', label: '2) Active Members' },
  { value: 'Starting Church Team', label: '3) Starting Church Team' },
  { value: 'Active Church Team', label: '4) Active Church Team' },
];

interface OrganizationDetailsProps {
  organization: Organization;
  regionOptions?: string[];
}

export default function OrganizationDetails({ organization, regionOptions = DEFAULT_REGION_OPTIONS }: OrganizationDetailsProps) {
  const [optimisticOrganization, setOptimisticOrganization] = useState(organization);

  const handleSaveAddress = async (field: 'street' | 'city' | 'state' | 'zip', value: string) => {
    const previous = (optimisticOrganization as any)[field];
    setOptimisticOrganization((prev) => ({ ...prev, [field]: value } as any));
    const result = await updateOrganizationAddressAction(organization.id, { [field]: value || null });
    if ('error' in result && result.error) {
      setOptimisticOrganization((prev) => ({ ...prev, [field]: previous } as any));
      toast.error(result.error);
      throw new Error(result.error);
    }
    toast.success('Address updated');
  };

  const handleSaveRegions = async (regions: string[]) => {
    const previous = (optimisticOrganization as any).regions || [];
    setOptimisticOrganization((prev) => ({ ...prev, regions } as any));
    const result = await updateOrganizationRegionsAction(organization.id, regions);
    if ('error' in result && result.error) {
      setOptimisticOrganization((prev) => ({ ...prev, regions: previous } as any));
      toast.error(result.error);
    } else {
      toast.success('Region updated');
    }
  };

  const handleSaveField = async (field: keyof Organization | 'engagement_level', value: string) => {
    const previousValue = (optimisticOrganization as any)[field];
    setOptimisticOrganization(prev => ({ ...prev, [field]: value }));

    const formData = new FormData();
    formData.append('id', organization.id.toString());
    formData.append('name', field === 'name' ? value : optimisticOrganization.name);
    formData.append('website', field === 'website' ? value : (optimisticOrganization.website || ''));
    formData.append('type', field === 'type' ? value : (optimisticOrganization.type || ''));
    formData.append('description', field === 'description' ? value : (optimisticOrganization.description || ''));
    formData.append('size', field === 'size' ? value : (optimisticOrganization.size || ''));
    formData.append('status', field === 'status' ? value : (optimisticOrganization.status || 'Potential Lead'));

    const result = await updateOrganizationAction({}, formData);

    if ('error' in result && result.error) {
      setOptimisticOrganization(prev => ({ ...prev, [field]: previousValue }));
      toast.error(result.error);
      throw new Error(result.error);
    } else if ('success' in result && result.success) {
      toast.success('Organization updated successfully');
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">Organization details</CardTitle>
          <SuggestDetailsButton organizationId={organization.id} />
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="grid gap-x-4 gap-y-3 md:grid-cols-3">
          <InlineEditField
            label="Organization name"
            value={optimisticOrganization.name}
            onSave={(value) => handleSaveField('name', value)}
            placeholder="Enter organization name"
          />

          <InlineEditField
            label="Engagement status"
            value={optimisticOrganization.status || 'Potential Lead'}
            onSave={(value) => handleSaveField('status', value)}
            type="select"
            options={ENGAGEMENT_STATUSES}
            placeholder="Select status"
          />

          <InlineEditField
            label="Organization type"
            value={optimisticOrganization.type || ''}
            onSave={(value) => handleSaveField('type', value)}
            type="select"
            options={ORG_TYPE_OPTIONS}
            placeholder="Select type"
          />

          <InlineEditField
            label="Website"
            value={optimisticOrganization.website || ''}
            onSave={(value) => handleSaveField('website', value)}
            placeholder="https://example.com"
          />

          <RegionMultiSelect
            value={(optimisticOrganization as any).regions || []}
            onChange={handleSaveRegions}
            options={regionOptions}
          />

          <InlineEditField
            label="Size"
            value={optimisticOrganization.size || ''}
            onSave={(value) => handleSaveField('size', value)}
            placeholder="e.g., 1-10, 50-100"
          />

          <InlineEditField
            label="Street address"
            value={(optimisticOrganization as any).street || ''}
            onSave={(value) => handleSaveAddress('street', value)}
            placeholder="Enter street address"
          />

          <InlineEditField
            label="City"
            value={(optimisticOrganization as any).city || ''}
            onSave={(value) => handleSaveAddress('city', value)}
            placeholder="Enter city"
          />

          <InlineEditField
            label="State"
            value={(optimisticOrganization as any).state || ''}
            onSave={(value) => handleSaveAddress('state', value)}
            placeholder="Enter state"
          />

          <InlineEditField
            label="ZIP"
            value={(optimisticOrganization as any).zip || ''}
            onSave={(value) => handleSaveAddress('zip', value)}
            placeholder="Enter ZIP"
          />

          <InlineEditField
            label="Description"
            value={optimisticOrganization.description || ''}
            onSave={(value) => handleSaveField('description', value)}
            placeholder="Enter organization description"
            multiline
            className="md:col-span-3"
          />
        </div>

        {/* Priority follow up toggle */}
        <div className="mt-4 pt-4 border-t border-border/30">
          <button
            onClick={async () => {
              const next = !(optimisticOrganization as any).priority_follow_up;
              setOptimisticOrganization((prev) => ({ ...prev, priority_follow_up: next } as any));
              const formData = new FormData();
              formData.append('id', optimisticOrganization.id.toString());
              formData.append('name', optimisticOrganization.name);
              formData.append('website', optimisticOrganization.website || '');
              formData.append('type', (optimisticOrganization as any).type || '');
              formData.append('description', optimisticOrganization.description || '');
              formData.append('size', optimisticOrganization.size || '');
              formData.append('status', optimisticOrganization.status || 'Potential Lead');
              formData.append('priority_follow_up', String(next));
              const result = await updateOrganizationAction({}, formData);
              if ('error' in result && result.error) {
                setOptimisticOrganization((prev) => ({ ...prev, priority_follow_up: !next } as any));
                toast.error(result.error);
              } else {
                toast.success(next ? 'Marked as priority follow up' : 'Removed priority flag');
              }
            }}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
              (optimisticOrganization as any).priority_follow_up
                ? 'border-red-500/40 bg-red-500/10 text-red-500'
                : 'border-border/50 text-muted-foreground hover:bg-muted/40'
            }`}
          >
            {(optimisticOrganization as any).priority_follow_up ? '🚩 Priority follow up (on)' : '⬜ Mark as priority follow up'}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
