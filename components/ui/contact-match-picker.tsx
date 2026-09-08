'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ContactOption {
  id: number;
  name: string;
  email?: string | null;
}

interface ContactMatchPickerProps {
  contacts: ContactOption[];
  onSelect: (contact: { id: number; name: string }) => void;
  onCancel: () => void;
  className?: string;
}

export function ContactMatchPicker({
  contacts,
  onSelect,
  onCancel,
  className,
}: ContactMatchPickerProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return contacts.slice(0, 60);
    const lower = query.toLowerCase();
    return contacts
      .filter(
        (c) =>
          c.name.toLowerCase().includes(lower) ||
          (c.email && c.email.toLowerCase().includes(lower))
      )
      .slice(0, 60);
  }, [contacts, query]);

  return (
    <div
      className={cn(
        'mt-2 border border-border rounded-lg bg-background shadow-sm p-2 space-y-1.5',
        className
      )}
    >
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search contacts…"
          className="h-7 pl-7 text-xs"
          autoFocus
        />
      </div>
      <div className="max-h-36 overflow-y-auto divide-y divide-border/30">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 text-center">
            No contacts found
          </p>
        ) : (
          filtered.map((c) => (
            <button
              key={c.id}
              className="w-full text-left px-2 py-1.5 hover:bg-muted/60 text-xs"
              onClick={() => onSelect({ id: c.id, name: c.name })}
            >
              <div className="font-medium">{c.name}</div>
              {c.email && (
                <div className="text-muted-foreground">{c.email}</div>
              )}
            </button>
          ))
        )}
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="w-full h-6 text-xs"
        onClick={onCancel}
      >
        Cancel
      </Button>
    </div>
  );
}
