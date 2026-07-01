'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Organization } from '@/lib/db/schema';
import { InlineEditField } from './inline-edit-field';
import { updateOrganizationAction } from './actions';
import { toast } from 'sonner';

const ORG_TYPE_OPTIONS = [
  { value: 'Church', label: 'Church' },
  { value: 'Community Group', label: 'Community group' },
  { value: 'Business', label: 'Business' },
  { value: 'Nonprofit', label: 'Nonprofit' },
  { value: 'School', label: 'School' },
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
}

export default function OrganizationDetails({ organization }: OrganizationDetailsProps) {
  const [optimisticOrganization, setOptimisticOrganization] = useState(organization);

  const handleSaveField = async (field: keyof Organization | 'engagement_level', value: string) => {
    const previousValue = (optimisticOrganization as any)[field];
    setOptimisticOrganization(prev => ({ ...prev, [field]: value }));

    const formData = new FormData();
    formData.append('id', organization.id.toString());
    formData.append('name', field === 'name' ? value : optimisticOrganization.name);
    formData.append('website', field === 'website' ? value : (optimisticOrganization.website || ''));
    formData.append('industry', optimisticOrganization.industry || '');
    formData.append('type', field === 'type' ? value : (optimisticOrganization.type || ''));
    formData.append('description', field === 'description' ? value : (optimisticOrganization.description || ''));
    formData.append('location', field === 'location' ? value : (optimisticOrganization.location || ''));
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
        <CardTitle className="text-base font-semibold">Organization details</CardTitle>
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

          <InlineEditField
            label="Location"
            value={optimisticOrganization.location || ''}
            onSave={(value) => handleSaveField('location', value)}
            placeholder="Enter location"
          />

          <InlineEditField
            label="Size"
            value={optimisticOrganization.size || ''}
            onSave={(value) => handleSaveField('size', value)}
            placeholder="e.g., 1-10, 50-100"
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
              formData.append('industry', optimisticOrganization.industry || '');
              formData.append('description', optimisticOrganization.description || '');
              formData.append('location', optimisticOrganization.location || '');
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
