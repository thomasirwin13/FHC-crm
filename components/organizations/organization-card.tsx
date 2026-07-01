'use client';

import { useRouter } from 'next/navigation';
import { Building2, MoreHorizontal, Pencil, Trash2, MapPin, Users, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Organization, User as UserType } from '@/lib/db/schema';
import { cn } from '@/lib/utils';

type OrganizationWithRelations = Organization & {
  user: Pick<UserType, 'id' | 'name' | 'email'>;
};

interface OrganizationCardProps {
  organization: OrganizationWithRelations;
  onDelete?: (organization: OrganizationWithRelations) => void;
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
}

const statusColors: Record<string, string> = {
  'Potential Lead':       'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  'Contact Made':         'bg-blue-500/10 text-blue-500 border-blue-500/20',
  'Active Members':       'bg-amber-500/10 text-amber-500 border-amber-500/20',
  'Starting Church Team': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  'Active Church Team':   'bg-green-500/10 text-green-500 border-green-500/20',
};

const STATUS_LABELS: Record<string, string> = {
  'Potential Lead':       '0) Potential Lead',
  'Contact Made':         '1) Contact Made',
  'Active Members':       '2) Active Members',
  'Starting Church Team': '3) Starting Church Team',
  'Active Church Team':   '4) Active Church Team',
};
const fmtStatus = (s: string) => STATUS_LABELS[s] ?? s;

export function OrganizationCard({ organization, onDelete, selected, onToggleSelect }: OrganizationCardProps) {
  const router = useRouter();
  const selectionMode = onToggleSelect !== undefined;

  return (
    <div
      className={`bg-card border rounded-lg p-3 cursor-pointer transition-all duration-150 active:scale-[0.99] ${
        selected ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-primary/30'
      }`}
      onClick={() => selectionMode ? onToggleSelect(organization.id) : router.push(`/app/organizations/${organization.id}`)}
    >
      {/* Main row: Icon, Name/Industry, Status, Menu */}
      <div className="flex items-center gap-3">
        {selectionMode ? (
          <input
            type="checkbox"
            checked={selected ?? false}
            onChange={() => onToggleSelect(organization.id)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 flex-shrink-0 cursor-pointer"
          />
        ) : (
          <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{organization.name}</span>
            {organization.size && (
              <span className="text-xs text-muted-foreground flex items-center gap-0.5 flex-shrink-0">
                <Users className="h-3 w-3" />
                {organization.size}
              </span>
            )}
          </div>
          {organization.industry && (
            <p className="text-xs text-muted-foreground truncate">{organization.industry}</p>
          )}
        </div>

        <Badge
          variant="outline"
          className={cn(
            'text-xs flex-shrink-0',
            statusColors[organization.status as keyof typeof statusColors] || statusColors.Lead
          )}
        >
          {fmtStatus(organization.status)}
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/app/organizations/${organization.id}`);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              View details
            </DropdownMenuItem>
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(organization);
                  }}
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

      {/* Secondary info row */}
      {organization.location && (
        <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            {organization.location}
          </span>
        </div>
      )}
    </div>
  );
}
