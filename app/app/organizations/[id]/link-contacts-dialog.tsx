'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { linkExistingContactsAction } from './contact-actions';

interface AvailableContact {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  organization?: { id: number; name: string } | null;
}

interface LinkContactsDialogProps {
  organizationId: number;
  availableContacts: AvailableContact[];
  onLinked: (contacts: AvailableContact[]) => void;
}

export function LinkContactsDialog({ organizationId, availableContacts, onLinked }: LinkContactsDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [linking, setLinking] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return availableContacts;
    const q = query.toLowerCase();
    return availableContacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.organization?.name?.toLowerCase().includes(q)
    );
  }, [availableContacts, query]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLink = async () => {
    if (selectedIds.size === 0) return;
    setLinking(true);
    const ids = Array.from(selectedIds);
    const result = await linkExistingContactsAction(ids, organizationId);
    if ('error' in result && result.error) {
      toast.error(result.error);
      setLinking(false);
      return;
    }
    toast.success(result.success);
    const linked = availableContacts.filter((c) => ids.includes(c.id));
    onLinked(linked);
    setOpen(false);
    setQuery('');
    setSelectedIds(new Set());
    setLinking(false);
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setQuery('');
      setSelectedIds(new Set());
    }
  };

  if (availableContacts.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus className="h-3.5 w-3.5 mr-1.5" />
          Link existing
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Link existing contacts</DialogTitle>
          <DialogDescription>
            Search and select contacts from your team to add to this organization.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or organization…"
            className="pl-9"
            autoFocus
          />
        </div>

        {/* Selected count */}
        {selectedIds.size > 0 && (
          <p className="text-xs text-muted-foreground -mt-1">
            {selectedIds.size} contact{selectedIds.size !== 1 ? 's' : ''} selected
          </p>
        )}

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto border border-border/50 rounded-lg divide-y divide-border/30">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No contacts found.</p>
          ) : (
            filtered.map((contact) => {
              const selected = selectedIds.has(contact.id);
              return (
                <label
                  key={contact.id}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                    selected ? 'bg-primary/5' : 'hover:bg-muted/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSelect(contact.id)}
                    className="h-4 w-4 flex-shrink-0 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{contact.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {contact.email && (
                        <span className="text-xs text-muted-foreground truncate">{contact.email}</span>
                      )}
                      {contact.organization && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5 flex-shrink-0">
                          <Building2 className="h-3 w-3" />
                          {contact.organization.name}
                        </span>
                      )}
                    </div>
                  </div>
                  {selected && <Badge className="text-xs h-4 px-1.5 flex-shrink-0">selected</Badge>}
                </label>
              );
            })
          )}
        </div>

        <div className="flex justify-between items-center gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={linking}>
            Cancel
          </Button>
          <Button onClick={handleLink} disabled={selectedIds.size === 0 || linking}>
            {linking ? 'Linking…' : `Link ${selectedIds.size > 0 ? selectedIds.size : ''} contact${selectedIds.size !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
