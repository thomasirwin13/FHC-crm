import { redirect } from 'next/navigation';
import { getUser, getTeamForUser, getContactById, getOrganizationsForContact, getOrganizationsForTeam, getOneOnOnesForContact, getMeetingAttendanceForContact, getCategoriesForContact, getCategoriesForTeam } from '@/lib/db/supabase-queries';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import ContactDetails from './contact-details';
import OneOnOnesSection from './one-on-ones-section';
import MeetingHistorySection from './meeting-history-section';
import OrganizationsSection from './organizations-section';
import CategoriesSection from './categories-section';
import { UserCircle, Mail, Phone, MapPin, Building2 } from 'lucide-react';
import Link from 'next/link';

export default async function ContactDetailPage({
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
  const contactId = parseInt(id);

  if (!contactId || isNaN(contactId)) {
    redirect('/app/contacts');
  }

  const contact = await getContactById(contactId, team.id);
  if (!contact) {
    redirect('/app/contacts');
  }

  const [contactOrgs, allOrgs, oneOnOnes, meetingHistory, contactCategories, allCategories] = await Promise.all([
    getOrganizationsForContact(contactId, team.id),
    getOrganizationsForTeam(team.id),
    getOneOnOnesForContact(contactId, team.id),
    getMeetingAttendanceForContact(contactId, team.id),
    getCategoriesForContact(contactId, team.id),
    getCategoriesForTeam(team.id),
  ]);

  const teamMembers = (team.team_members || []).map((tm: any) => ({
    id: tm.user?.id,
    name: tm.user?.name,
    email: tm.user?.email,
  })).filter((m: any) => m.id);

  const breadcrumbItems = [
    { label: 'All contacts', href: '/app/contacts' },
    { label: contact.name, isCurrentPage: true },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4 w-full">
        {/* Breadcrumbs */}
        <Breadcrumb items={breadcrumbItems} />

        {/* Hero Section */}
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 border border-border/50">
              <UserCircle className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold tracking-tight mb-1.5">{contact.name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {contactOrgs.map((org) => (
                  <Link
                    key={org.id}
                    href={`/app/organizations/${org.id}`}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    <Building2 className="h-4 w-4" />
                    <span className="underline underline-offset-2">{org.name}</span>
                  </Link>
                ))}
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    <Mail className="h-4 w-4" />
                    <span>{contact.email}</span>
                  </a>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-4 w-4" />
                    <span>{contact.phone}</span>
                  </div>
                )}
                {(contact.city || contact.state) && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    <span>{[contact.city, contact.state].filter(Boolean).join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Contact Details Section */}
        <ContactDetails contact={contact} />

        {/* Organizations */}
        <OrganizationsSection
          contactId={contactId}
          initialOrganizations={contactOrgs.map((o) => ({ id: o.id, name: o.name, type: (o as any).type }))}
          allOrganizations={allOrgs.map((o) => ({ id: o.id, name: o.name, type: (o as any).type }))}
        />

        {/* Categories */}
        <CategoriesSection
          contactId={contactId}
          initialCategories={contactCategories}
          allCategories={allCategories}
        />

        {/* 1-on-1 Meetings */}
        <OneOnOnesSection
          contactId={contactId}
          initialOneOnOnes={oneOnOnes}
          teamMembers={teamMembers}
        />

        {/* Meeting Attendance History */}
        <MeetingHistorySection initialHistory={meetingHistory} />
      </div>
    </div>
  );
}
