'use client';

import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OrganizationCard } from './organization-card';
import { Organization, User as UserType } from '@/lib/db/schema';

type OrganizationWithRelations = Organization & {
  user: Pick<UserType, 'id' | 'name' | 'email'>;
};

interface OrganizationsGridProps {
  organizations: OrganizationWithRelations[];
  onDelete?: (organization: OrganizationWithRelations) => void;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
}

export function OrganizationsGrid({ organizations, onDelete, selectedIds, onToggleSelect }: OrganizationsGridProps) {
  const router = useRouter();

  if (organizations.length === 0) {
    return (
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
  }

  return (
    <div className="space-y-2">
      {organizations.map((organization) => (
        <OrganizationCard
          key={organization.id}
          organization={organization}
          onDelete={onDelete}
          selected={selectedIds?.has(organization.id)}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}
