'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Contact } from '@/lib/db/schema';
import { InlineEditField } from '@/app/app/organizations/[id]/inline-edit-field';
import { updateContactAction, updateContactRegionsAction } from '@/app/app/organizations/[id]/contact-actions';
import { toggleActionCommittedAction } from './one-on-one-actions';
import { updatePreferredContactMethodAction, updateEngagementLevelAction } from './category-actions';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

const REGION_OPTIONS = [
  'Antelope Valley',
  'San Fernando Valley',
  'San Gabriel Valley',
  'Metro/Central LA',
  'West LA',
  'South LA',
  'South East LA',
  'South Bay',
  'Orange County',
  'Other',
];

const ENGAGEMENT_LEVELS = [
  { value: 'potential', label: 'Potential (Level 0)' },
  { value: 'learner', label: 'Learner (Level 1)' },
  { value: 'participator', label: 'Participator (Level 2)' },
  { value: 'attender', label: 'Attender (Level 3)' },
  { value: 'activist', label: 'Activist (Level 4)' },
];

const CONTACT_METHODS = [
  { value: 'custom_email', label: 'Custom email' },
  { value: 'email_newsletter', label: 'Email newsletter' },
  { value: 'custom_text', label: 'Custom text' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

type TeamMember = { id: number; name: string | null; email: string };

interface ContactDetailsProps {
  contact: Contact;
  teamMembers: TeamMember[];
}

export default function ContactDetails({ contact, teamMembers }: ContactDetailsProps) {
  const [optimistic, setOptimistic] = useState(contact);
  const [actionCommitted, setActionCommitted] = useState((contact as any).action_committed ?? false);
  const [preferredMethod, setPreferredMethod] = useState((contact as any).preferred_contact_method ?? '');
  const [engagementLevel, setEngagementLevel] = useState((contact as any).engagement_level ?? 'potential');
  const [regions, setRegions] = useState<string[]>(((contact as any).regions || []) as string[]);
  const [assignedUserId, setAssignedUserId] = useState<string>(
    (contact as any).assigned_user_id ? String((contact as any).assigned_user_id) : '__none__'
  );

  const handleToggleAction = async (value: boolean) => {
    setActionCommitted(value);
    const result = await toggleActionCommittedAction(contact.id, value);
    if ('error' in result && result.error) {
      setActionCommitted(!value);
      toast.error(result.error);
    }
  };

  const handleEngagementLevel = async (value: string) => {
    const prev = engagementLevel;
    setEngagementLevel(value);
    const result = await updateEngagementLevelAction(contact.id, value);
    if ('error' in result && result.error) {
      setEngagementLevel(prev);
      toast.error(result.error);
    }
  };

  const handlePreferredMethod = async (value: string) => {
    const prev = preferredMethod;
    const next = value === '__none__' ? '' : value;
    setPreferredMethod(next);
    const result = await updatePreferredContactMethodAction(contact.id, next);
    if ('error' in result && result.error) {
      setPreferredMethod(prev);
      toast.error(result.error);
    }
  };

  const handleAssignedUser = async (value: string) => {
    const prev = assignedUserId;
    setAssignedUserId(value);
    const userId = value && value !== '__none__' ? parseInt(value) : null;
    const result = await updateContactAction({
      id: contact.id,
      organizationId: contact.organization_id || 0,
      assigned_user_id: userId,
    });
    if ('error' in result && result.error) {
      setAssignedUserId(prev);
      toast.error(result.error);
    }
  };

  const handleSaveField = async (field: keyof Contact, value: string) => {
    const previousValue = optimistic[field];
    setOptimistic(prev => ({ ...prev, [field]: value }));

    const result = await updateContactAction({
      id: contact.id,
      organizationId: contact.organization_id || 0,
      [field]: value || undefined,
    });

    if ('error' in result && result.error) {
      setOptimistic(prev => ({ ...prev, [field]: previousValue }));
      toast.error(result.error);
      throw new Error(result.error);
    } else if ('success' in result) {
      toast.success('Contact updated');
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Contact details</CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="grid gap-x-4 gap-y-3 md:grid-cols-3">
          <InlineEditField
            label="Name"
            value={optimistic.name}
            onSave={(value) => handleSaveField('name', value)}
            placeholder="Enter name"
          />

          <InlineEditField
            label="Email"
            value={optimistic.email || ''}
            onSave={(value) => handleSaveField('email', value)}
            placeholder="email@example.com"
          />

          <InlineEditField
            label="Secondary email"
            value={(optimistic as any).email_secondary || ''}
            onSave={(value) => handleSaveField('email_secondary' as keyof Contact, value)}
            placeholder="secondary@example.com"
          />

          <InlineEditField
            label="Phone"
            value={optimistic.phone || ''}
            onSave={(value) => handleSaveField('phone', value)}
            placeholder="Enter phone number"
          />

          <InlineEditField
            label="Secondary phone"
            value={(optimistic as any).phone_secondary || ''}
            onSave={(value) => handleSaveField('phone_secondary' as keyof Contact, value)}
            placeholder="Enter secondary phone"
          />

          <InlineEditField
            label="Street"
            value={optimistic.street || ''}
            onSave={(value) => handleSaveField('street', value)}
            placeholder="Enter street address"
          />

          <InlineEditField
            label="City"
            value={optimistic.city || ''}
            onSave={(value) => handleSaveField('city', value)}
            placeholder="Enter city"
          />

          <InlineEditField
            label="State"
            value={optimistic.state || ''}
            onSave={(value) => handleSaveField('state', value)}
            placeholder="Enter state"
          />

          <InlineEditField
            label="Zip"
            value={optimistic.zip || ''}
            onSave={(value) => handleSaveField('zip', value)}
            placeholder="Enter zip code"
          />

          {/* Region multi-select */}
          <div className="space-y-1 group">
            <Label className="text-xs font-medium text-muted-foreground">Region</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal h-auto min-h-9 py-1.5"
                >
                  <span className="flex flex-wrap gap-1 text-left">
                    {regions.length === 0 ? (
                      <span className="text-muted-foreground">Select region(s)</span>
                    ) : (
                      regions.map((r) => (
                        <span key={r} className="inline-flex items-center rounded bg-primary/10 text-primary px-1.5 py-0.5 text-xs">
                          {r}
                        </span>
                      ))
                    )}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandList>
                    <CommandGroup>
                      {(() => {
                        const allSelected = regions.length === REGION_OPTIONS.length;
                        return (
                          <CommandItem
                            value="__all__"
                            onSelect={async () => {
                              const prev = regions;
                              const next = allSelected ? [] : [...REGION_OPTIONS];
                              setRegions(next);
                              const result = await updateContactRegionsAction(contact.id, next);
                              if ('error' in result && result.error) {
                                setRegions(prev);
                                toast.error(result.error);
                              } else {
                                toast.success('Region updated');
                              }
                            }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', allSelected ? 'opacity-100' : 'opacity-0')} />
                            <span className="font-medium">All</span>
                          </CommandItem>
                        );
                      })()}
                      {REGION_OPTIONS.map((region) => {
                        const selected = regions.includes(region);
                        return (
                          <CommandItem
                            key={region}
                            value={region}
                            onSelect={async () => {
                              const prev = regions;
                              const next = selected ? prev.filter((r) => r !== region) : [...prev, region];
                              setRegions(next);
                              const result = await updateContactRegionsAction(contact.id, next);
                              if ('error' in result && result.error) {
                                setRegions(prev);
                                toast.error(result.error);
                              } else {
                                toast.success('Region updated');
                              }
                            }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', selected ? 'opacity-100' : 'opacity-0')} />
                            {region}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <InlineEditField
            label="Engagement level"
            value={engagementLevel}
            onSave={handleEngagementLevel}
            type="select"
            options={ENGAGEMENT_LEVELS}
            placeholder="Select level"
          />

          <InlineEditField
            label="Lead organizer"
            value={assignedUserId}
            onSave={handleAssignedUser}
            type="select"
            options={[
              { value: '__none__', label: 'Unassigned' },
              ...teamMembers.map((m) => ({ value: String(m.id), label: m.name || m.email })),
            ]}
            placeholder="Select organizer"
          />

          <InlineEditField
            label="Background"
            value={(optimistic as any).background || ''}
            onSave={(value) => handleSaveField('background' as keyof Contact, value)}
            placeholder="Add background notes about this contact…"
            type="textarea"
            className="col-span-full"
          />

          <div className="flex items-center gap-3 col-span-full pt-1">
            <Switch
              id="action-committed"
              checked={actionCommitted}
              onCheckedChange={handleToggleAction}
            />
            <Label htmlFor="action-committed" className="text-sm cursor-pointer">
              Committed to weekly action
            </Label>
          </div>

          {actionCommitted && (
            <InlineEditField
              label="Preferred contact method"
              value={preferredMethod}
              onSave={handlePreferredMethod}
              type="select"
              options={[
                { value: '__none__', label: '— None —' },
                ...CONTACT_METHODS,
              ]}
              placeholder="Select method"
              className="col-span-full sm:col-span-1"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
