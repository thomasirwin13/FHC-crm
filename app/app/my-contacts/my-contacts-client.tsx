'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandEmpty,
} from '@/components/ui/command';
import { UserCircle, Phone, Mail, Building2, Calendar, MapPin, Plus, Search, UserPlus, X, ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContactQuickView } from '@/components/contacts/contacts-table';
import { createOneOnOneAction } from '@/app/app/contacts/[id]/one-on-one-actions';
import { addContactToMyListAction } from './actions';
import { toast } from 'sonner';
import { RichTextEditor, RichTextDisplay } from '@/components/ui/rich-text-editor';

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

const MEETING_FORM_OPTIONS = [
  { value: 'not_specified', label: 'Not specified' },
  { value: 'text_check_in', label: 'Text check-in' },
  { value: 'phone_call', label: 'Phone call' },
  { value: 'zoom_meeting', label: 'Zoom meeting' },
  { value: 'in_person', label: 'In-person meeting' },
];

const NOTES_TEMPLATE = `<h2>Position in the org/group:</h2>
<p></p>
<h2>Where do they find themselves within the 4 Faces?</h2>
<p></p>
<h2>The 2-3 most meaningful things they shared:</h2>
<ul><li></li></ul>
<h2>Additional stories to remember or possibly share with others:</h2>
<ul><li></li></ul>
<h2>Plan to follow up with this person:</h2>
<ul><li></li></ul>`;

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
  myOrganizations?: any[];
  allContacts?: { id: number; name: string; email?: string; organization?: { id: number; name: string } | null }[];
  currentUserId?: number;
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
  myOrganizations = [],
  allContacts = [],
  currentUserId,
}: MyContactsClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState('contacts');
  const [quickViewContact, setQuickViewContact] = useState<any | null>(null);

  // 1-on-1 dialog state
  const [oneOnOneDialogOpen, setOneOnOneDialogOpen] = useState(false);
  const [ooSelectedContacts, setOoSelectedContacts] = useState<number[]>([]);
  const [ooContactPickerOpen, setOoContactPickerOpen] = useState(false);
  const [ooDate, setOoDate] = useState('');
  const [ooNotes, setOoNotes] = useState('');
  const [ooUserId, setOoUserId] = useState<string>(currentUserId ? String(currentUserId) : 'manual');
  const [ooOrganizerName, setOoOrganizerName] = useState('');
  const [ooMeetingForm, setOoMeetingForm] = useState<string>('not_specified');
  const [ooLoading, setOoLoading] = useState(false);

  // Add contact dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [addingId, setAddingId] = useState<number | null>(null);

  const myContactIds = useMemo(() => new Set(contacts.map((c: any) => c.id)), [contacts]);

  const addableContacts = useMemo(() => {
    return allContacts.filter(c => !myContactIds.has(c.id));
  }, [allContacts, myContactIds]);

  const filteredAddable = useMemo(() => {
    if (!addSearch.trim()) return addableContacts.slice(0, 20);
    const q = addSearch.toLowerCase();
    return addableContacts
      .filter(c => c.name.toLowerCase().includes(q) || (c.email && c.email.toLowerCase().includes(q)) || (c.organization?.name && c.organization.name.toLowerCase().includes(q)))
      .slice(0, 20);
  }, [addableContacts, addSearch]);

  const handleAddContact = async (contactId: number) => {
    setAddingId(contactId);
    const result = await addContactToMyListAction(contactId);
    setAddingId(null);
    if ('error' in result && result.error) {
      toast.error(result.error);
    } else {
      toast.success('Contact added to your list');
      setAddDialogOpen(false);
      setAddSearch('');
      router.refresh();
    }
  };

  const handleToggleOoContact = (contactId: number) => {
    setOoSelectedContacts(prev =>
      prev.includes(contactId) ? prev.filter(id => id !== contactId) : [...prev, contactId]
    );
  };

  const handleCreateOneOnOne = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ooSelectedContacts.length === 0) {
      toast.error('Please select at least one contact');
      return;
    }
    setOoLoading(true);
    let errorCount = 0;
    for (const contactId of ooSelectedContacts) {
      const result = await createOneOnOneAction({
        contact_id: contactId,
        date: ooDate,
        notes: ooNotes || undefined,
        user_id: ooUserId !== 'manual' ? parseInt(ooUserId) : null,
        organizer_name: ooUserId === 'manual' ? ooOrganizerName || undefined : undefined,
        meeting_form: ooMeetingForm,
      });
      if ('error' in result && result.error) errorCount++;
    }
    setOoLoading(false);
    if (errorCount > 0) {
      toast.error(`Failed to log ${errorCount} of ${ooSelectedContacts.length} meeting(s)`);
    } else {
      toast.success(ooSelectedContacts.length === 1 ? '1-on-1 logged' : `${ooSelectedContacts.length} 1-on-1s logged`);
    }
    setOneOnOneDialogOpen(false);
    setOoSelectedContacts([]);
    setOoDate('');
    setOoNotes('');
    setOoUserId(currentUserId ? String(currentUserId) : 'manual');
    setOoOrganizerName('');
    setOoMeetingForm('not_specified');
    router.refresh();
  };

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

  const ContactRow = ({ contact, showLevel, showFrequency }: { contact: any; showLevel?: boolean; showFrequency?: boolean }) => {
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
            {contact.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {contact.phone}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {lastDate ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {format(new Date(lastDate), 'MMM d')}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/50">No 1-on-1</span>
          )}
          {showFrequency && contact.outreach_frequency && (
            <Badge variant="outline" className="text-xs capitalize">
              {contact.outreach_frequency}
            </Badge>
          )}
          {showLevel && (
            <Badge
              variant="outline"
              className={cn('text-xs', ENGAGEMENT_COLORS[contact.engagement_level] || '')}
            >
              {ENGAGEMENT_LABELS[contact.engagement_level] || 'Potential'}
            </Badge>
          )}
          {contact.action_committed && (
            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
              Committed
            </Badge>
          )}
        </div>
      </Link>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My contacts</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Contacts and 1-on-1 meetings assigned to you ({contacts.length} contact{contacts.length !== 1 ? 's' : ''})
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAddDialogOpen(true)}
          className="flex-shrink-0"
        >
          <UserPlus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Add contact</span>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="contacts">By level</TabsTrigger>
          <TabsTrigger value="frequency">By outreach frequency</TabsTrigger>
          <TabsTrigger value="one-on-ones">1-on-1 meetings</TabsTrigger>
          <TabsTrigger value="organizations">My organizations</TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="space-y-4 mt-4">
          {contacts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <UserCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No contacts assigned to you yet.</p>
                <p className="text-sm mt-1">Use the &ldquo;Add contact&rdquo; button to add contacts to your list.</p>
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
                        <ContactRow key={contact.id} contact={contact} showFrequency />
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
                      {items.map((contact: any) => (
                        <ContactRow key={contact.id} contact={contact} showLevel />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="one-on-ones" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setOneOnOneDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Log 1-on-1
            </Button>
          </div>
          {oneOnOnes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No 1-on-1 meetings recorded yet.</p>
                <p className="text-sm mt-1">Use the button above to log your first 1-on-1.</p>
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
                          <div className="mt-1 ml-6 line-clamp-2">
                            <RichTextDisplay html={meeting.notes} className="text-sm text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="organizations" className="space-y-4 mt-4">
          {myOrganizations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No organizations assigned to you yet.</p>
                <p className="text-sm mt-1">Assign yourself as an organizer on organization pages to see them here.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold">
                    My organizations
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">{myOrganizations.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="divide-y divide-border/30">
                  {myOrganizations.map((org: any) => (
                    <Link
                      key={org.id}
                      href={`/app/organizations/${org.id}`}
                      className="w-full text-left flex items-center gap-3 py-2.5 group hover:bg-muted/30 -mx-3 px-3 rounded-md transition-colors no-underline text-inherit"
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium group-hover:text-primary transition-colors">
                          {org.name}
                        </span>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {org.type && (
                            <span>{org.type}</span>
                          )}
                          {(org.city || org.state) && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {[org.city, org.state].filter(Boolean).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {org.status && (
                          <Badge variant="outline" className="text-xs">
                            {org.status}
                          </Badge>
                        )}
                        {((org.regions || []) as string[]).length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {(org.regions as string[])[0]}
                            {(org.regions as string[]).length > 1 && ` +${(org.regions as string[]).length - 1}`}
                          </Badge>
                        )}
                      </div>
                    </Link>
                  ))}
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

      {/* Log 1-on-1 dialog */}
      <Dialog open={oneOnOneDialogOpen} onOpenChange={setOneOnOneDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log 1-on-1 meeting</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateOneOnOne} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Contacts</Label>
              <Popover open={ooContactPickerOpen} onOpenChange={setOoContactPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal h-auto min-h-10 py-1.5"
                  >
                    <span className="flex flex-wrap gap-1 text-left">
                      {ooSelectedContacts.length === 0 ? (
                        <span className="text-muted-foreground">Select contacts...</span>
                      ) : (
                        ooSelectedContacts.map(id => {
                          const c = contacts.find((ct: any) => ct.id === id);
                          return (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1 rounded bg-primary/10 text-primary px-1.5 py-0.5 text-xs"
                            >
                              {c?.name || `#${id}`}
                              <button
                                type="button"
                                className="hover:text-destructive"
                                onClick={(e) => { e.stopPropagation(); handleToggleOoContact(id); }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })
                      )}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search contacts..." />
                    <CommandList>
                      <CommandEmpty>No contacts found.</CommandEmpty>
                      <CommandGroup>
                        {contacts.map((c: any) => {
                          const selected = ooSelectedContacts.includes(c.id);
                          return (
                            <CommandItem
                              key={c.id}
                              value={c.name}
                              onSelect={() => handleToggleOoContact(c.id)}
                            >
                              <Check className={cn('mr-2 h-4 w-4', selected ? 'opacity-100' : 'opacity-0')} />
                              <span>{c.name}</span>
                              {c.organization?.name && (
                                <span className="ml-auto text-xs text-muted-foreground">{c.organization.name}</span>
                              )}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={ooDate} onChange={e => setOoDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Meeting form</Label>
              <Select value={ooMeetingForm} onValueChange={setOoMeetingForm}>
                <SelectTrigger>
                  <SelectValue placeholder="Select form" />
                </SelectTrigger>
                <SelectContent>
                  {MEETING_FORM_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Organizer</Label>
              <Select value={ooUserId} onValueChange={setOoUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organizer" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map(m => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name || m.email}</SelectItem>
                  ))}
                  <SelectItem value="manual">Other (enter name)</SelectItem>
                </SelectContent>
              </Select>
              {ooUserId === 'manual' && (
                <Input
                  className="mt-2"
                  placeholder="Organizer name"
                  value={ooOrganizerName}
                  onChange={e => setOoOrganizerName(e.target.value)}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setOoNotes(prev => (prev.trim() && prev !== '<p></p>' ? prev + NOTES_TEMPLATE : NOTES_TEMPLATE))}
                >
                  Use template
                </Button>
              </div>
              <RichTextEditor
                value={ooNotes}
                onChange={setOoNotes}
                placeholder="What was discussed..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOneOnOneDialogOpen(false)} disabled={ooLoading}>Cancel</Button>
              <Button type="submit" disabled={ooLoading}>{ooLoading ? 'Saving...' : 'Save'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add contact to my list dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(v) => { setAddDialogOpen(v); if (!v) setAddSearch(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add contact to my list</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts by name, email, or organization..."
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
              {addSearch && (
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setAddSearch('')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto space-y-1">
              {filteredAddable.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {addSearch ? 'No matching contacts found.' : 'All contacts are already on your list.'}
                </p>
              ) : (
                filteredAddable.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 px-2 py-2 rounded-md hover:bg-muted/50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {c.organization?.name && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {c.organization.name}
                          </span>
                        )}
                        {c.email && (
                          <span className="truncate">{c.email}</span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-shrink-0 h-7"
                      disabled={addingId === c.id}
                      onClick={() => handleAddContact(c.id)}
                    >
                      {addingId === c.id ? 'Adding...' : (
                        <>
                          <Plus className="h-3 w-3 mr-1" />
                          Add
                        </>
                      )}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
