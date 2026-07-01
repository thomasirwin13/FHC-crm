import { Suspense } from 'react';
import Link from 'next/link';
import { getTeamForUser, getOrganizationsForTeam, getUser } from '@/lib/db/supabase-queries';
import OrganizationsList from './organizations-list';
import UploadOrganizationsCsvDialog from './upload-csv-dialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { SkeletonTable } from '@/components/ui/skeleton-field';

export default async function OrganizationsPage() {
  const team = await getTeamForUser();

  if (!team) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="text-2xl font-bold mb-4">Organizations</h1>
        <p className="text-muted-foreground">No team found. Please contact support.</p>
      </div>
    );
  }

  const [organizations, currentUser] = await Promise.all([
    getOrganizationsForTeam(team.id),
    getUser(),
  ]);

  const teamMembers = ((team as any).team_members || []).map((m: any) => ({
    id: m.user.id as number,
    name: m.user.name as string | null,
    email: m.user.email as string,
  }));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Sticky header */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4 px-6 lg:px-8 py-5 border-b border-border/50 bg-background">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
          <p className="text-muted-foreground mt-1 hidden sm:block">
            Manage your organizations and track opportunities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UploadOrganizationsCsvDialog existingOrganizations={organizations} />
          <Button
            asChild
            variant="outline"
            size="sm"
            className="flex-shrink-0 border-border hover:bg-accent hover:border-foreground/20 transition-all duration-150"
          >
            <Link href="/app/organizations/new">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add organization</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6">
        <Suspense fallback={<SkeletonTable rows={5} cols={7} />}>
          <OrganizationsList
            initialOrganizations={organizations}
            teamId={team.id}
            teamMembers={teamMembers}
            currentUserId={currentUser?.id ?? null}
          />
        </Suspense>
      </div>
    </div>
  );
}
