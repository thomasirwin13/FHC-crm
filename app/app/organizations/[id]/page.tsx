import { redirect } from 'next/navigation';
import { getUser, getTeamForUser, getOrganizationById, getContactsForOrganization, getContactsForTeam } from '@/lib/db/supabase-queries';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import OrganizationDetails from './organization-details';
import { ContactsTable } from './contacts-table';
import { Badge } from '@/components/ui/badge';
import { Building2, Globe, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<string, string> = {
  'Potential Lead':       '0) Potential Lead',
  'Contact Made':         '1) Contact Made',
  'Active Members':       '2) Active Members',
  'Starting Church Team': '3) Starting Church Team',
  'Active Church Team':   '4) Active Church Team',
};

const statusColors: Record<string, string> = {
  'Potential Lead':       'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  'Contact Made':         'bg-blue-500/10 text-blue-500 border-blue-500/20',
  'Active Members':       'bg-amber-500/10 text-amber-500 border-amber-500/20',
  'Starting Church Team': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  'Active Church Team':   'bg-green-500/10 text-green-500 border-green-500/20',
  // legacy values
  Lead: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  Opportunity: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  Client: 'bg-green-500/10 text-green-500 border-green-500/20',
  Churned: 'bg-red-500/10 text-red-500 border-red-500/20',
  'Closed Lost': 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getUser();
  if (!user) {
    redirect('/login');
  }

  const team = await getTeamForUser();
  if (!team) {
    redirect('/login');
  }

  const { id } = await params;
  const organizationId = parseInt(id);

  if (!organizationId || isNaN(organizationId)) {
    redirect('/app/organizations');
  }

  const organization = await getOrganizationById(organizationId, team.id);
  if (!organization) {
    redirect('/app/organizations');
  }

  const [contacts, allTeamContacts] = await Promise.all([
    getContactsForOrganization(organizationId, team.id),
    getContactsForTeam(team.id),
  ]);

  const breadcrumbItems = [
    { label: 'All organizations', href: '/app/organizations' },
    { label: organization.name, isCurrentPage: true },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4 w-full">
        {/* Breadcrumbs */}
        <Breadcrumb items={breadcrumbItems} />

        {/* Hero Section */}
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 border border-border/50">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1.5">
                <h1 className="text-2xl font-bold tracking-tight">{organization.name}</h1>
                <Badge
                  variant="outline"
                  className={cn(
                    'transition-all duration-150',
                    statusColors[organization.status as keyof typeof statusColors] || statusColors['Potential Lead']
                  )}
                >
                  {STATUS_LABELS[organization.status as string] ?? organization.status}
                </Badge>
                {(organization as any).type && (
                  <Badge variant="secondary" className="font-normal">
                    {(organization as any).type}
                  </Badge>
                )}
              </div>
              {organization.description && (
                <p className="text-muted-foreground text-sm leading-relaxed max-w-3xl">
                  {organization.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                {organization.size && (
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    <span>{organization.size} employees</span>
                  </div>
                )}
                {organization.website && (
                  <a
                    href={organization.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    <Globe className="h-4 w-4" />
                    <span className="underline underline-offset-2">Visit website</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Organization Details Section */}
        <OrganizationDetails organization={organization} />

        {/* Contacts Section */}
        <ContactsTable
          contacts={contacts}
          organizationId={organizationId}
          teamLeaderId={(organization as any).team_leader_id ?? null}
          allTeamContacts={allTeamContacts}
        />
      </div>
    </div>
  );
}
