'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Loader2, CheckCircle2, ChevronsUpDown, Check, Plus, X, Trash2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { createFullContactAction, createOrganizationAction } from './actions';
import { Organization } from '@/lib/db/schema';

const ENGAGEMENT_LEVELS = [
  { value: 'potential', label: 'Potential (Level 0)' },
  { value: 'learner', label: 'Learner (Level 1)' },
  { value: 'participator', label: 'Participator (Level 2)' },
  { value: 'attender', label: 'Attender (Level 3)' },
  { value: 'activist', label: 'Activist (Level 4)' },
  { value: 'leader', label: 'Lead at aligned partner org (Level 5)' },
  { value: 'leader_non_aligned', label: 'Leader of non-aligned partner org (Level 1a)' },
  { value: 'unlikely', label: 'Unlikely to be interested (A)' },
  { value: 'out_of_scope', label: 'Out of geographic scope (B)' },
];

const MEETING_FORM_OPTIONS = [
  { value: 'not_specified', label: 'Not specified' },
  { value: 'text_check_in', label: 'Text check-in' },
  { value: 'phone_call', label: 'Phone call' },
  { value: 'zoom_meeting', label: 'Zoom meeting' },
  { value: 'in_person', label: 'In-person meeting' },
];

type TeamMember = { id: number; name: string | null; email: string };
type Category = { id: number; name: string; color: string };

interface OneOnOneDraft {
  date: string;
  meeting_form: string;
  userId: string; // numeric string or 'manual'
  organizerName: string;
  notes: string;
}

interface CreateContactFormProps {
  organizations: (Organization & { user: { id: number; name: string | null; email: string } })[];
  teamMembers: TeamMember[];
  categories: Category[];
  regionOptions: string[];
  currentUserId: number;
}

export function CreateContactForm({
  organizations,
  teamMembers,
  categories,
  regionOptions,
  currentUserId,
}: CreateContactFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Organization
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [newOrgName, setNewOrgName] = useState('');
  const [creatingNewOrg, setCreatingNewOrg] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Engagement fields
  const [engagementLevel, setEngagementLevel] = useState('potential');
  const [selectedOrganizers, setSelectedOrganizers] = useState<number[]>([]);
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [regions, setRegions] = useState<string[]>([]);
  const [regionOpen, setRegionOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');

  // 1-on-1 meetings
  const [oneOnOnes, setOneOnOnes] = useState<OneOnOneDraft[]>([]);

  const sortedOrganizations = [...organizations].sort((a, b) => a.name.localeCompare(b.name));
  const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));
  const memberLabel = (m: TeamMember) => m.name || m.email;

  const toggleOrganizer = (id: number) =>
    setSelectedOrganizers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleRegion = (region: string) =>
    setRegions((prev) => (prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]));

  const toggleCategory = (name: string) =>
    setSelectedCategories((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));

  const addOneOnOne = () =>
    setOneOnOnes((prev) => [
      ...prev,
      {
        date: '',
        meeting_form: 'not_specified',
        userId: currentUserId ? String(currentUserId) : 'manual',
        organizerName: '',
        notes: '',
      },
    ]);

  const updateOneOnOne = (index: number, patch: Partial<OneOnOneDraft>) =>
    setOneOnOnes((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));

  const removeOneOnOne = (index: number) =>
    setOneOnOnes((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);

    let orgId = selectedOrgId ? parseInt(selectedOrgId, 10) : undefined;

    if (creatingNewOrg && newOrgName.trim()) {
      const orgResult = await createOrganizationAction(newOrgName.trim());
      if ('error' in orgResult) {
        toast.error(orgResult.error);
        setIsSubmitting(false);
        return;
      }
      orgId = orgResult.data.id;
    }

    // Validate 1-on-1 drafts: only send those with a date
    const oneOnOnePayload = oneOnOnes
      .filter((o) => o.date)
      .map((o) => ({
        date: o.date,
        meeting_form: o.meeting_form,
        user_id: o.userId !== 'manual' ? parseInt(o.userId, 10) : null,
        organizer_name: o.userId === 'manual' ? o.organizerName || undefined : undefined,
        notes: o.notes || undefined,
      }));

    const result = await createFullContactAction({
      name: formData.get('name') as string,
      email: (formData.get('email') as string) || undefined,
      phone: (formData.get('phone') as string) || undefined,
      street: (formData.get('street') as string) || undefined,
      city: (formData.get('city') as string) || undefined,
      state: (formData.get('state') as string) || undefined,
      zip: (formData.get('zip') as string) || undefined,
      background: (formData.get('background') as string) || undefined,
      organizationId: orgId,
      engagement_level: engagementLevel,
      regions,
      organizerIds: selectedOrganizers,
      categories: selectedCategories,
      oneOnOnes: oneOnOnePayload,
    });

    if ('error' in result && result.error) {
      toast.error(result.error);
      setIsSubmitting(false);
    } else if ('success' in result) {
      setShowSuccess(true);
      toast.success('Contact created successfully');
      setTimeout(() => {
        router.push('/app/contacts');
      }, 800);
    }
  };

  if (showSuccess) {
    return (
      <Card className="border-green-500/20 bg-green-500/5 animate-in fade-in duration-300">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <CheckCircle2 className="h-16 w-16 text-green-500 mb-4 animate-in zoom-in duration-300" />
          <h3 className="text-lg font-semibold mb-2">Contact created!</h3>
          <p className="text-sm text-muted-foreground">Redirecting to contacts...</p>
        </CardContent>
      </Card>
    );
  }

  const sectionHeading = (text: string) => (
    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide pt-2">{text}</h2>
  );

  return (
    <Card className="border-border/50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic info */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" placeholder="Enter contact name" required />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="email@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" placeholder="Enter phone number" />
            </div>
          </div>

          {/* Organization */}
          <div className="space-y-2">
            <Label htmlFor="organization">Organization</Label>
            {creatingNewOrg ? (
              <div className="flex gap-2">
                <Input
                  placeholder="New organization name"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCreatingNewOrg(false);
                    setNewOrgName('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboOpen}
                    className="w-full justify-between font-normal"
                  >
                    {selectedOrgId
                      ? sortedOrganizations.find((o) => o.id.toString() === selectedOrgId)?.name
                      : <span className="text-muted-foreground">Select an organization (optional)</span>}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search organizations…" onValueChange={setSearchQuery} />
                    <CommandList>
                      <CommandEmpty>
                        <div className="py-1">
                          <p className="text-sm text-muted-foreground mb-2">No organizations found.</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              setCreatingNewOrg(true);
                              setNewOrgName(searchQuery);
                              setComboOpen(false);
                            }}
                          >
                            <Plus className="mr-2 h-3.5 w-3.5" />
                            Create &ldquo;{searchQuery}&rdquo;
                          </Button>
                        </div>
                      </CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="__create_new__"
                          onSelect={() => {
                            setCreatingNewOrg(true);
                            setNewOrgName('');
                            setSelectedOrgId('');
                            setComboOpen(false);
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Create new organization
                        </CommandItem>
                        {selectedOrgId && (
                          <CommandItem
                            value="__clear__"
                            onSelect={() => {
                              setSelectedOrgId('');
                              setComboOpen(false);
                            }}
                          >
                            <Check className="mr-2 h-4 w-4 opacity-0" />
                            <span className="text-muted-foreground">Clear selection</span>
                          </CommandItem>
                        )}
                        {sortedOrganizations.map((org) => (
                          <CommandItem
                            key={org.id}
                            value={org.name}
                            onSelect={() => {
                              setSelectedOrgId(org.id.toString());
                              setComboOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedOrgId === org.id.toString() ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            {org.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Address */}
          {sectionHeading('Address')}
          <div className="space-y-2">
            <Label htmlFor="street">Street</Label>
            <Input id="street" name="street" placeholder="Enter street address" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" placeholder="Enter city" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" placeholder="Enter state" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">Zip</Label>
              <Input id="zip" name="zip" placeholder="Enter ZIP code" />
            </div>
          </div>

          {/* Engagement & organizing */}
          {sectionHeading('Engagement & organizing')}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Lead organizer(s) */}
            <div className="space-y-2">
              <Label>Lead organizer(s)</Label>
              <Popover open={organizerOpen} onOpenChange={setOrganizerOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {selectedOrganizers.length === 0 ? (
                      <span className="text-muted-foreground">Select organizer(s)</span>
                    ) : (
                      `${selectedOrganizers.length} selected`
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search team…" />
                    <CommandList>
                      <CommandEmpty>No team members found.</CommandEmpty>
                      <CommandGroup>
                        {teamMembers.map((m) => (
                          <CommandItem key={m.id} value={memberLabel(m)} onSelect={() => toggleOrganizer(m.id)}>
                            <Check className={cn('mr-2 h-4 w-4', selectedOrganizers.includes(m.id) ? 'opacity-100' : 'opacity-0')} />
                            {memberLabel(m)}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedOrganizers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedOrganizers.map((id) => {
                    const m = teamMembers.find((tm) => tm.id === id);
                    return m ? (
                      <span key={id} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
                        {memberLabel(m)}
                        <button type="button" onClick={() => toggleOrganizer(id)} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            {/* Engagement level */}
            <div className="space-y-2">
              <Label>Engagement level</Label>
              <Select value={engagementLevel} onValueChange={setEngagementLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  {ENGAGEMENT_LEVELS.map((lvl) => (
                    <SelectItem key={lvl.value} value={lvl.value}>{lvl.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Region */}
            <div className="space-y-2">
              <Label>Region</Label>
              <Popover open={regionOpen} onOpenChange={setRegionOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {regions.length === 0 ? (
                      <span className="text-muted-foreground">Select region(s)</span>
                    ) : (
                      `${regions.length} selected`
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search regions…" />
                    <CommandList>
                      <CommandEmpty>No regions found.</CommandEmpty>
                      <CommandGroup>
                        {regionOptions.map((region) => (
                          <CommandItem key={region} value={region} onSelect={() => toggleRegion(region)}>
                            <Check className={cn('mr-2 h-4 w-4', regions.includes(region) ? 'opacity-100' : 'opacity-0')} />
                            {region}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {regions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {regions.map((r) => (
                    <span key={r} className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                      {r}
                      <button type="button" onClick={() => toggleRegion(r)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Categories */}
            <div className="space-y-2">
              <Label>Categories</Label>
              <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {selectedCategories.length === 0 ? (
                      <span className="text-muted-foreground">Select categories</span>
                    ) : (
                      `${selectedCategories.length} selected`
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search or create…" onValueChange={setCategoryQuery} />
                    <CommandList>
                      <CommandEmpty>
                        {categoryQuery.trim() ? (
                          <div className="py-1 px-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => {
                                const name = categoryQuery.trim();
                                if (name && !selectedCategories.includes(name)) {
                                  setSelectedCategories((prev) => [...prev, name]);
                                }
                                setCategoryQuery('');
                              }}
                            >
                              <Plus className="mr-2 h-3.5 w-3.5" />
                              Create &ldquo;{categoryQuery.trim()}&rdquo;
                            </Button>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No categories.</span>
                        )}
                      </CommandEmpty>
                      <CommandGroup>
                        {sortedCategories.map((cat) => (
                          <CommandItem key={cat.id} value={cat.name} onSelect={() => toggleCategory(cat.name)}>
                            <Check className={cn('mr-2 h-4 w-4', selectedCategories.includes(cat.name) ? 'opacity-100' : 'opacity-0')} />
                            {cat.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedCategories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedCategories.map((name) => (
                    <span key={name} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
                      {name}
                      <button type="button" onClick={() => toggleCategory(name)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Background */}
          <div className="space-y-2">
            <Label htmlFor="background">Background</Label>
            <Textarea
              id="background"
              name="background"
              placeholder="Add background notes about this contact…"
              rows={4}
            />
          </div>

          {/* 1-on-1 meetings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              {sectionHeading('1-on-1 meetings')}
              <Button type="button" variant="outline" size="sm" onClick={addOneOnOne}>
                <Plus className="h-4 w-4 mr-1" /> Add 1-on-1
              </Button>
            </div>

            {oneOnOnes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No 1-on-1 meetings added. These are optional.</p>
            ) : (
              <div className="space-y-4">
                {oneOnOnes.map((o, i) => (
                  <div key={i} className="rounded-md border border-border/50 bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-muted-foreground" /> Meeting {i + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeOneOnOne(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Date</Label>
                        <Input
                          type="date"
                          value={o.date}
                          onChange={(e) => updateOneOnOne(i, { date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Meeting form</Label>
                        <Select value={o.meeting_form} onValueChange={(v) => updateOneOnOne(i, { meeting_form: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MEETING_FORM_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Organizer</Label>
                      <Select value={o.userId} onValueChange={(v) => updateOneOnOne(i, { userId: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select organizer" />
                        </SelectTrigger>
                        <SelectContent>
                          {teamMembers.map((m) => (
                            <SelectItem key={m.id} value={String(m.id)}>{memberLabel(m)}</SelectItem>
                          ))}
                          <SelectItem value="manual">Other (enter name)</SelectItem>
                        </SelectContent>
                      </Select>
                      {o.userId === 'manual' && (
                        <Input
                          className="mt-2"
                          placeholder="Organizer name"
                          value={o.organizerName}
                          onChange={(e) => updateOneOnOne(i, { organizerName: e.target.value })}
                        />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
                      <Textarea
                        placeholder="What was discussed…"
                        rows={3}
                        value={o.notes}
                        onChange={(e) => updateOneOnOne(i, { notes: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/app/contacts')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create contact'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
