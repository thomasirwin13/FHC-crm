'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserCircle, Phone, Mail, Building2, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContactQuickView } from '@/components/contacts/contacts-table';

interface Category {
  id: number;
  name: string;
  color: string;
}

interface TeamMember {
  id: number;
  name: string | null;
  email: string;
}

const ENGAGEMENT_LABELS: Record<string, string> = {
  potential: 'Potential (Level 0)',
  learner: 'Learner (Level 1)',
  participator: 'Participator (Level 2)',
  attender: 'Attender (Level 3)',
  activist: 'Activist (Level 4)',
};

const ENGAGEMENT_COLORS: Record<string, string> = {
  potential: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
  learner: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  participator: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  attender: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  activist: 'bg-green-500/10 text-green-500 border-green-500/20',
};

const ENGAGEMENT_ORDER = ['activist', 'attender', 'participator', 'learner', 'potential'];

const FREQUENCY_ORDER = ['weekly', 'monthly', 'quarterly', 'yearly', '__none__'] as const;
const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  __none__: 'Not set',
};
const FREQUENCY_COLORS: Record<string, string> = {
  weekly: 'bg-red-500/10 text-red-500 border-red-500/20',
  monthly: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  quarterly: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  yearly: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
  __none__: '',
};

const MEETING_FORM_LABELS: Record<string, string> = {
  not_specified: 'Not specified',
  text_check_in: 'Text check-in',
  phone_call: 'Phone call',
  zoom_meeting: 'Zoom meeting',
  in_person: 'In-person meeting',
};

interface MyContactsClientProps {
  contacts: any[];
  oneOnOnes: any[];
  userName: string;
  categories: Category[];
  teamMembers: TeamMember[];
  organizations: { id: number; name: string }[];
  regionOptions: string[];
  assignmentMap: Record<number, number[]>;
  contactOrganizerMap: Record<number, number[]>;
}

export default function MyContactsClient({
  contacts,
  oneOnOnes,
  userName,
  categories,
  teamMembers,
  organizations,
  regionOptions,
  assignmentMap,
  contactOrganizerMap,
}: MyContactsClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState('contacts');
  const [quickViewContact, setQuickViewContact] = useState<any | null>(null);

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const level of ENGAGEMENT_ORDER) {
      groups[level] = [];
    }
    for (const c of contacts) {
      const level = c.engagement_level || 'potential';
      if (!groups[level]) groups[level] = [];
      groups[level].push(c);
    }
    return groups;
  }, [contacts]);

  const groupedByFrequency = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const freq of FREQUENCY_ORDER) {
      groups[freq] = [];
    }
    for (const c of contacts) {
      const freq = c.outreach_frequency || '__none__';
      if (!groups[freq]) groups[freq] = [];
      groups[freq].push(c);
    }
    return groups;
  }, [contacts]);

  const lastOneOnOneByContact = useMemo(() => {
    const map: Record<number, string> = {};
    for (const m of oneOnOnes) {
      const cid = m.contact_id;
      if (cid && m.date && !map[cid]) {
        map[cid] = m.date;
      }
    }
    return map;
  }, [oneOnOnes]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My contacts</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Contacts and 1-on-1 meetings assigned to you ({contacts.length} contact{contacts.length !== 1 ? 's' : ''})
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="contacts">By level</TabsTrigger>
          <TabsTrigger value="frequency">By outreach frequency</TabsTrigger>
          <TabsTrigger value="one-on-ones">1-on-1 meetings</TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="space-y-4 mt-4">
          {contacts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <UserCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No contacts assigned to you yet.</p>
                <p className="text-sm mt-1">Assign yourself as a lead organizer on contact pages to see them here.</p>
              </CardContent>
            </Card>
          ) : (
            ENGAGEMENT_ORDER.map((level) => {
              const items = grouped[level] || [];
              if (items.length === 0) return null;
              return (
                <Card key={level} className="border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-semibold">
                        {ENGAGEMENT_LABELS[level] || level}
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="divide-y divide-border/30">
                      {items.map((contact: any) => (
                        <Link
                          key={contact.id}
                          href={`/app/contacts/${contact.id}`}
                          onClick={(e) => {
                            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                            e.preventDefault();
                            setQuickViewContact(contact);
                          }}
                          className="w-full text-left flex items-center gap-3 py-2.5 group hover:bg-muted/30 -mx-3 px-3 rounded-md transition-colors no-underline text-inherit"
                        >
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <UserCircle className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium group-hover:text-primary transition-colors">
                              {contact.name}
                            </span>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              {contact.organization?.name && (
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {contact.organization.name}
                                </span>
                              )}
                              {contact.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {contact.email}
                                </span>
                              )}
                              {contact.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {contact.phone}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {contact.outreach_frequency && (
                              <Badge variant="outline" className="text-xs capitalize">
                                {contact.outreach_frequency}
                              </Badge>
                            )}
                            {contact.action_committed && (
                              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                                Committed
                              </Badge>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="frequency" className="space-y-4 mt-4">
          {contacts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <UserCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No contacts assigned to you yet.</p>
              </CardContent>
            </Card>
          ) : (
            FREQUENCY_ORDER.map((freq) => {
              const items = groupedByFrequency[freq] || [];
              if (items.length === 0) return null;
              return (
                <Card key={freq} className="border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-semibold">
                        {FREQUENCY_LABELS[freq]}
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="divide-y divide-border/30">
                      {items.map((contact: any) => {
                        const lastDate = lastOneOnOneByContact[contact.id];
                        return (
                          <Link
                            key={contact.id}
                            href={`/app/contacts/${contact.id}`}
                            onClick={(e) => {
                              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                              e.preventDefault();
                              setQuickViewContact(contact);
                            }}
                            className="w-full text-left flex items-center gap-3 py-2.5 group hover:bg-muted/30 -mx-3 px-3 rounded-md transition-colors no-underline text-inherit"
                          >
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <UserCircle className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium group-hover:text-primary transition-colors">
                                {contact.name}
                              </span>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                {contact.organization?.name && (
                                  <span className="flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    {contact.organization.name}
                                  </span>
                                )}
                                {contact.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {contact.email}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {lastDate ? (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(lastDate), 'MMM d, yyyy')}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/50">No 1-on-1</span>
                              )}
                              <Badge
                                variant="outline"
                                className={cn('text-xs', ENGAGEMENT_COLORS[contact.engagement_level] || '')}
                              >
                                {ENGAGEMENT_LABELS[contact.engagement_level] || 'Potential'}
                              </Badge>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="one-on-ones" className="space-y-4 mt-4">
          {oneOnOnes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No 1-on-1 meetings recorded yet.</p>
                <p className="text-sm mt-1">Log 1-on-1 meetings from individual contact pages.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50">
              <CardContent className="pt-4">
                <div className="divide-y divide-border/30">
                  {oneOnOnes.map((meeting: any) => {
                    const contact = meeting.contacts;
                    return (
                      <div key={meeting.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {meeting.date ? format(new Date(meeting.date), 'MMM d, yyyy') : 'No date'}
                            </span>
                            {contact && (
                              <Link
                                href={`/app/contacts/${contact.id}`}
                                className="text-sm text-primary hover:underline"
                              >
                                {contact.name}
                              </Link>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {meeting.meeting_form && meeting.meeting_form !== 'not_specified' && (
                              <Badge variant="secondary" className="text-xs">
                                {MEETING_FORM_LABELS[meeting.meeting_form] || meeting.meeting_form}
                              </Badge>
                            )}
                            {contact?.engagement_level && (
                              <Badge
                                variant="outline"
                                className={cn('text-xs', ENGAGEMENT_COLORS[contact.engagement_level] || '')}
                              >
                                {ENGAGEMENT_LABELS[contact.engagement_level] || contact.engagement_level}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {meeting.notes && (
                          <p className="text-sm text-muted-foreground mt-1 ml-6 line-clamp-2">
                            {meeting.notes}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <ContactQuickView
        contact={quickViewContact}
        open={quickViewContact !== null}
        onOpenChange={(v) => {
          if (!v) {
            setQuickViewContact(null);
            router.refresh();
          }
        }}
        categories={categories}
        assignmentMap={assignmentMap}
        teamMembers={teamMembers}
        organizations={organizations}
        regionOpts={regionOptions}
        contactOrganizerMap={contactOrganizerMap}
      />
    </div>
  );
}
