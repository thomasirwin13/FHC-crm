'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
import { Loader2, CheckCircle2, ChevronsUpDown, Check, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { createContactAction } from '@/app/app/organizations/[id]/contact-actions';
import { createOrganizationAction } from './actions';
import { Organization } from '@/lib/db/schema';

interface CreateContactFormProps {
  organizations: (Organization & { user: { id: number; name: string | null; email: string } })[];
}

export function CreateContactForm({ organizations }: CreateContactFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [newOrgName, setNewOrgName] = useState('');
  const [creatingNewOrg, setCreatingNewOrg] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const sortedOrganizations = [...organizations].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

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

    const result = await createContactAction({
      name: formData.get('name') as string,
      email: (formData.get('email') as string) || undefined,
      phone: (formData.get('phone') as string) || undefined,
      city: (formData.get('city') as string) || undefined,
      state: (formData.get('state') as string) || undefined,
      organizationId: orgId,
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

  return (
    <Card className="border-border/50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              name="name"
              placeholder="Enter contact name"
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="email@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                placeholder="Enter phone number"
              />
            </div>
          </div>

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
                    <CommandInput
                      placeholder="Search organizations…"
                      onValueChange={setSearchQuery}
                    />
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

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                name="city"
                placeholder="Enter city"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                name="state"
                placeholder="Enter state"
              />
            </div>
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
