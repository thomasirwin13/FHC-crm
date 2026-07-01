'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Building2, X, Plus, ChevronsUpDown, Check } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { addContactOrganizationAction, removeContactOrganizationAction } from '@/app/app/organizations/[id]/contact-actions';

interface Org {
  id: number;
  name: string;
  type?: string | null;
}

interface OrganizationsSectionProps {
  contactId: number;
  initialOrganizations: Org[];
  allOrganizations: Org[];
}

export default function OrganizationsSection({
  contactId,
  initialOrganizations,
  allOrganizations,
}: OrganizationsSectionProps) {
  const [organizations, setOrganizations] = useState<Org[]>(initialOrganizations);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);

  const linkedIds = new Set(organizations.map((o) => o.id));
  const available = allOrganizations
    .filter((o) => !linkedIds.has(o.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleAdd = async () => {
    if (!selectedOrgId) return;
    const orgId = parseInt(selectedOrgId, 10);
    const org = allOrganizations.find((o) => o.id === orgId);
    if (!org) return;

    setAdding(true);
    const result = await addContactOrganizationAction(contactId, orgId);
    if ('error' in result && result.error) {
      toast.error(result.error);
    } else {
      setOrganizations((prev) => [...prev, org]);
      setSelectedOrgId('');
      setShowAdd(false);
      toast.success(`Added to ${org.name}`);
    }
    setAdding(false);
  };

  const handleRemove = async (org: Org) => {
    const result = await removeContactOrganizationAction(contactId, org.id);
    if ('error' in result && result.error) {
      toast.error(result.error);
    } else {
      setOrganizations((prev) => prev.filter((o) => o.id !== org.id));
      toast.success(`Removed from ${org.name}`);
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Organizations</CardTitle>
          {!showAdd && available.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {organizations.length === 0 && !showAdd && (
          <p className="text-sm text-muted-foreground py-2">
            Not linked to any organizations yet.
          </p>
        )}

        {organizations.map((org) => (
          <div
            key={org.id}
            className="flex items-center justify-between gap-2 p-2 rounded-md border border-border/50 hover:bg-muted/30"
          >
            <Link
              href={`/app/organizations/${org.id}`}
              className="flex items-center gap-2 text-sm hover:underline underline-offset-2 flex-1 min-w-0"
            >
              <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate font-medium">{org.name}</span>
              {org.type && (
                <span className="text-xs text-muted-foreground flex-shrink-0">· {org.type}</span>
              )}
            </Link>
            <button
              onClick={() => handleRemove(org)}
              className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors flex-shrink-0"
              title="Remove from organization"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {showAdd && (
          <div className="flex gap-2 pt-1">
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboOpen}
                  className="flex-1 h-9 justify-between font-normal"
                >
                  {selectedOrgId
                    ? available.find((o) => o.id.toString() === selectedOrgId)?.name
                    : 'Select an organization…'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search organizations…" />
                  <CommandList>
                    <CommandEmpty>No organizations found.</CommandEmpty>
                    <CommandGroup>
                      {available.map((org) => (
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
                          {org.type && (
                            <span className="text-muted-foreground ml-1">· {org.type}</span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Button size="sm" onClick={handleAdd} disabled={!selectedOrgId || adding}>
              {adding ? 'Adding…' : 'Add'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setSelectedOrgId(''); setComboOpen(false); }}>
              Cancel
            </Button>
          </div>
        )}

        {showAdd && available.length === 0 && (
          <p className="text-sm text-muted-foreground">
            This contact is already linked to all organizations.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
