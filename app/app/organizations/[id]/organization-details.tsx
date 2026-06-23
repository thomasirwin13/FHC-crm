'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Organization } from '@/lib/db/schema';
import { InlineEditField } from './inline-edit-field';
import { updateOrganizationAction } from './actions';
import { toast } from 'sonner';
import { organizationStatusOptions } from '@/lib/constants/organization';

const ENGAGEMENT_LEVELS = [
  { value: 'potential', label: 'Potential (Level 0)' },
  { value: 'learner', label: 'Learner (Level 1)' },
  { value: 'participator', label: 'Participator (Level 2)' },
  { value: 'attender', label: 'Attender (Level 3)' },
  { value: 'activist', label: 'Activist (Level 4)' },
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
    formData.append('industry', field === 'industry' ? value : (optimisticOrganization.industry || ''));
    formData.append('description', field === 'description' ? value : (optimisticOrganization.description || ''));
    formData.append('location', field === 'location' ? value : (optimisticOrganization.location || ''));
    formData.append('size', field === 'size' ? value : (optimisticOrganization.size || ''));
    formData.append('status', field === 'status' ? value : (optimisticOrganization.status || 'Lead'));
    formData.append('engagement_level', field === 'engagement_level' ? value : ((optimisticOrganization as any).engagement_level || 'potential'));

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
            label="Engagement level"
            value={(optimisticOrganization as any).engagement_level || 'potential'}
            onSave={(value) => handleSaveField('engagement_level', value)}
            type="select"
            options={ENGAGEMENT_LEVELS}
            placeholder="Select level"
          />

          <InlineEditField
            label="Status"
            value={optimisticOrganization.status || 'Lead'}
            onSave={(value) => handleSaveField('status', value)}
            type="select"
            options={organizationStatusOptions}
            placeholder="Select status"
          />

          <InlineEditField
            label="Industry"
            value={optimisticOrganization.industry || ''}
            onSave={(value) => handleSaveField('industry', value)}
            placeholder="Enter industry"
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
      </CardContent>
    </Card>
  );
}
