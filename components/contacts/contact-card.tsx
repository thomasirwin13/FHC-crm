'use client';

import { UserCircle, MoreHorizontal, Trash2, Building2, Mail, Phone, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ContactWithOrganization } from '@/lib/db/supabase-queries';
import Link from 'next/link';

const ENGAGEMENT_LABELS: Record<string, string> = {
  potential: 'Potential',
  learner: 'Learner',
  participator: 'Participator',
  attender: 'Attender',
  activist: 'Activist',
};

interface ContactCardProps {
  contact: ContactWithOrganization;
  onDelete?: (contact: ContactWithOrganization) => void;
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
}

export function ContactCard({ contact, onDelete, selected, onToggleSelect }: ContactCardProps) {
  const selectionMode = onToggleSelect !== undefined;

  const Wrapper = selectionMode ? 'div' : Link;
  const wrapperProps = selectionMode
    ? { onClick: () => onToggleSelect(contact.id) }
    : { href: `/app/contacts/${contact.id}` };

  return (
    <Wrapper
      {...(wrapperProps as any)}
      className={`block bg-card border rounded-lg p-3 cursor-pointer transition-all duration-150 active:scale-[0.99] no-underline text-inherit ${
        selected ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-primary/30'
      }`}
    >
      {/* Main row */}
      <div className="flex items-center gap-3">
        {selectionMode ? (
          <input
            type="checkbox"
            checked={selected ?? false}
            onChange={() => onToggleSelect(contact.id)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 flex-shrink-0 cursor-pointer"
          />
        ) : (
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <UserCircle className="h-4 w-4 text-primary" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{contact.name}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0">
              {ENGAGEMENT_LABELS[(contact as any).engagement_level ?? 'potential'] ?? 'Potential'}
            </Badge>
          </div>
          {contact.organization && (
            <Link
              href={`/app/organizations/${contact.organization.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 truncate"
            >
              <Building2 className="h-3 w-3 flex-shrink-0" />
              {contact.organization.name}
            </Link>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {contact.organization && (
              <DropdownMenuItem asChild>
                <Link href={`/app/organizations/${contact.organization.id}`}>
                  <Building2 className="mr-2 h-4 w-4" />
                  View organization
                </Link>
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                {contact.organization && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onClick={() => onDelete(contact)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Secondary info */}
      {(contact.email || contact.phone || contact.city) && (
        <div className="mt-2 pt-2 border-t border-border/50 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {contact.email && (
            <a href={`mailto:${contact.email}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 truncate hover:text-foreground transition-colors">
              <Mail className="h-3 w-3 flex-shrink-0" />
              {contact.email}
            </a>
          )}
          {contact.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3 flex-shrink-0" />
              {contact.phone}
            </span>
          )}
          {(contact.city || contact.state) && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              {[contact.city, contact.state].filter(Boolean).join(', ')}
            </span>
          )}
        </div>
      )}
    </Wrapper>
  );
}
