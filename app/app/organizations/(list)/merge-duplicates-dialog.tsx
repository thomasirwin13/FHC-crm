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
import { Badge } from '@/components/ui/badge';
import { GitMerge, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { mergeOrganizationsAction } from '@/app/app/organizations/merge-actions';

interface Org {
  id: number;
  name: string;
  website?: string | null;
  type?: string | null;
  status?: string | null;
}

interface DuplicateGroup {
  key: string;
  reason: 'name';
  orgs: Org[];
}

function normalize(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

function findDuplicateGroups(orgs: Org[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const byName = new Map<string, Org[]>();

  for (const org of orgs) {
    const key = normalize(org.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(org);
  }

  for (const [name, group] of byName) {
    if (group.length < 2) continue;
    groups.push({ key: name, reason: 'name', orgs: group });
  }

  return groups;
}

interface GroupRowProps {
  group: DuplicateGroup;
  onMerged: (survivorId: number, removedIds: number[]) => void;
}

function GroupRow({ group, onMerged }: GroupRowProps) {
  const [primaryId, setPrimaryId] = useState(group.orgs[0].id);
  const [expanded, setExpanded] = useState(true);
  const [merging, setMerging] = useState(false);
  const [done, setDone] = useState(false);

  const duplicateIds = group.orgs.filter((o) => o.id !== primaryId).map((o) => o.id);

  const handleMerge = async () => {
    setMerging(true);
    const result = await mergeOrganizationsAction(primaryId, duplicateIds);
    if ('error' in result && result.error) {
      toast.error(result.error);
      setMerging(false);
    } else {
      toast.success(result.success || 'Organizations merged');
      setDone(true);
      onMerged(primaryId, duplicateIds);
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg border border-border/50 bg-muted/30 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
        <span>Merged into <strong>{group.orgs.find((o) => o.id === primaryId)?.name}</strong></span>
      </div>
    );
  }

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-3 text-sm hover:bg-muted/30 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium truncate">{group.orgs[0].name}</span>
          <Badge variant="outline" className="text-xs flex-shrink-0">
            same name · {group.orgs.length} organizations
          </Badge>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-border/50">
          <div className="divide-y divide-border/50">
            {group.orgs.map((org) => (
              <label
                key={org.id}
                className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/20 transition-colors"
              >
                <input
                  type="radio"
                  name={`primary-org-${group.key}`}
                  value={org.id}
                  checked={primaryId === org.id}
                  onChange={() => setPrimaryId(org.id)}
                  className="mt-0.5 flex-shrink-0"
                />
                <div className="flex-1 min-w-0 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{org.name}</span>
                    {primaryId === org.id && (
                      <Badge className="text-xs h-4 px-1.5">keep</Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs mt-0.5 space-x-3">
                    {org.type && <span>{org.type}</span>}
                    {org.website && <span>{org.website}</span>}
                    {org.status && <span>· {org.status}</span>}
                  </div>
                </div>
              </label>
            ))}
          </div>
          <div className="p-3 border-t border-border/50 bg-muted/10 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              The kept organization will inherit all contacts from the others.
            </p>
            <Button size="sm" onClick={handleMerge} disabled={merging}>
              {merging ? 'Merging…' : 'Merge'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface MergeOrgDuplicatesDialogProps {
  organizations: Org[];
  onMerged: (survivorId: number, removedIds: number[]) => void;
}

export default function MergeOrgDuplicatesDialog({ organizations, onMerged }: MergeOrgDuplicatesDialogProps) {
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => findDuplicateGroups(organizations), [organizations]);

  if (groups.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex-shrink-0 border-border hover:bg-accent hover:border-foreground/20 transition-all duration-150">
          <GitMerge className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Merge duplicates</span>
          <Badge className="ml-1.5 h-4 px-1.5 text-xs">{groups.length}</Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Merge duplicate organizations</DialogTitle>
          <DialogDescription>
            {groups.length} group{groups.length !== 1 ? 's' : ''} of potential duplicates found. Select which organization to keep — the others will be merged into it, and all contacts will be transferred.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto space-y-3 pr-1">
          {groups.map((group) => (
            <GroupRow key={group.key} group={group} onMerged={onMerged} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
