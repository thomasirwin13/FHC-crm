import { redirect } from 'next/navigation';
import { getUser, getTeamForUser, getOrganizationsForTeam, getCategoriesForTeam } from '@/lib/db/supabase-queries';
import { resolveRegions } from '@/lib/integrations';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { CreateContactForm } from './create-contact-form';

export default async function NewContactPage() {
  const user = await getUser();
  if (!user) {
    redirect('/login');
  }

  const team = await getTeamForUser();
  if (!team) {
    redirect('/login');
  }

  const [organizations, categories, regionOptions] = await Promise.all([
    getOrganizationsForTeam(team.id),
    getCategoriesForTeam(team.id),
    resolveRegions(team.id),
  ]);

  const teamMembers = ((team as any).team_members || [])
    .map((m: any) => ({ id: m.user?.id, name: m.user?.name ?? null, email: m.user?.email }))
    .filter((m: any) => m.id);

  const currentUserId = user.id;

  const breadcrumbItems = [
    { label: 'All contacts', href: '/app/contacts' },
    { label: 'New contact', isCurrentPage: true },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 w-full">
        <Breadcrumb items={breadcrumbItems} />

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Add new contact</h1>
          <p className="text-muted-foreground">
            Add a new contact and optionally link them to an organization
          </p>
        </div>

        <CreateContactForm
          organizations={organizations}
          teamMembers={teamMembers}
          categories={categories as any[]}
          regionOptions={regionOptions}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  );
}
