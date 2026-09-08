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
import { mergeContactsAction } from '@/app/app/contacts/merge-actions';
import { ContactWithOrganization } from '@/lib/db/supabase-queries';
import { namesMatch } from '@/lib/utils/name-matching';

interface DuplicateGroup {
  key: string;
  reason: 'email' | 'name';
  contacts: ContactWithOrganization[];
}

function findDuplicateGroups(contacts: ContactWithOrganization[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const assigned = new Set<number>();

  // Email duplicates (strong signal — only non-empty emails)
  const byEmail = new Map<string, ContactWithOrganization[]>();
  for (const c of contacts) {
    if (!c.email) continue;
    const key = c.email.toLowerCase().trim();
    if (!byEmail.has(key)) byEmail.set(key, []);
    byEmail.get(key)!.push(c);
  }
  for (const [email, group] of byEmail) {
    if (group.length < 2) continue;
    groups.push({ key: email, reason: 'email', contacts: group });
    group.forEach((c) => assigned.add(c.id));
  }

  // Name duplicates (nickname-aware, only contacts not already grouped)
  const nameGrouped = new Set<number>();
  const remaining = contacts.filter((c) => !assigned.has(c.id));
  for (let i = 0; i < remaining.length; i++) {
    if (nameGrouped.has(remaining[i].id)) continue;
    const group: ContactWithOrganization[] = [remaining[i]];
    for (let j = i + 1; j < remaining.length; j++) {
      if (nameGrouped.has(remaining[j].id)) continue;
      if (namesMatch(remaining[i].name, remaining[j].name)) {
        group.push(remaining[j]);
      }
    }
    if (group.length >= 2) {
      groups.push({ key: remaining[i].name.toLowerCase().trim(), reason: 'name', contacts: group });
      group.forEach((c) => nameGrouped.add(c.id));
    }
  }

  return groups;
}

interface GroupRowProps {
  group: DuplicateGroup;
  onMerged: (survivorId: number, removedIds: number[]) => void;
}

function GroupRow({ group, onMerged }: GroupRowProps) {
  const [primaryId, setPrimaryId] = useState(group.contacts[0].id);
  const [expanded, setExpanded] = useState(true);
  const [merging, setMerging] = useState(false);
  const [done, setDone] = useState(false);
  const [emailPrimary, setEmailPrimary] = useState<string | null>(null);
  const [emailSecondary, setEmailSecondary] = useState<string | null>(null);
  const [phonePrimary, setPhonePrimary] = useState<string | null>(null);
  const [phoneSecondary, setPhoneSecondary] = useState<string | null>(null);

  const duplicateIds = group.contacts.filter((c) => c.id !== primaryId).map((c) => c.id);

  // Collect unique emails and phones across all contacts in the group
  const allEmails = useMemo(() => {
    const set = new Set<string>();
    group.contacts.forEach((c) => {
      if (c.email) set.add(c.email);
      if ((c as any).email_secondary) set.add((c as any).email_secondary);
    });
    return Array.from(set);
  }, [group.contacts]);

  const allPhones = useMemo(() => {
    const set = new Set<string>();
    group.contacts.forEach((c) => {
      if (c.phone) set.add(c.phone);
      if ((c as any).phone_secondary) set.add((c as any).phone_secondary);
    });
    return Array.from(set);
  }, [group.contacts]);

  const showEmailPicker = allEmails.length > 1;
  const showPhonePicker = allPhones.length > 1;

  const handleMerge = async () => {
    setMerging(true);
    const emailChoices = showEmailPicker
      ? { primary: emailPrimary || allEmails[0], secondary: emailSecondary }
      : undefined;
    const phoneChoices = showPhonePicker
      ? { primary: phonePrimary || allPhones[0], secondary: phoneSecondary }
      : undefined;
    const result = await mergeContactsAction(primaryId, duplicateIds, emailChoices, phoneChoices);
    if ('error' in result && result.error) {
      toast.error(result.error);
      setMerging(false);
    } else {
      toast.success(result.success || 'Contacts merged');
      setDone(true);
      onMerged(primaryId, duplicateIds);
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg border border-border/50 bg-muted/30 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
        <span>Merged into <strong>{group.contacts.find((c) => c.id === primaryId)?.name}</strong></span>
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
          <span className="font-medium truncate">{group.contacts[0].name}</span>
          <Badge variant="outline" className="text-xs flex-shrink-0">
            {group.reason === 'email' ? 'same email' : 'same name'} · {group.contacts.length} contacts
          </Badge>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-border/50">
          <div className="divide-y divide-border/50">
            {group.contacts.map((contact) => (
              <label
                key={contact.id}
                className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/20 transition-colors"
              >
                <input
                  type="radio"
                  name={`primary-${group.key}`}
                  value={contact.id}
                  checked={primaryId === contact.id}
                  onChange={() => setPrimaryId(contact.id)}
                  className="mt-0.5 flex-shrink-0"
                />
                <div className="flex-1 min-w-0 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{contact.name}</span>
                    {primaryId === contact.id && (
                      <Badge className="text-xs h-4 px-1.5">keep</Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs mt-0.5 space-x-3">
                    {contact.email && <span>{contact.email}</span>}
                    {contact.phone && <span>{contact.phone}</span>}
                    {contact.city && <span>{contact.city}{contact.state ? `, ${contact.state}` : ''}</span>}
                    {(contact as any).organization?.name && <span>· {(contact as any).organization.name}</span>}
                  </div>
                </div>
              </label>
            ))}
          </div>
          {/* Email/phone picker when multiple exist */}
          {(showEmailPicker || showPhonePicker) && (
            <div className="p-3 border-t border-border/50 bg-muted/10 space-y-2">
              {showEmailPicker && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Choose emails to keep:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Primary</p>
                      <select
                        className="w-full text-xs border border-border rounded px-1.5 py-1 bg-background"
                        value={emailPrimary || allEmails[0]}
                        onChange={(e) => {
                          setEmailPrimary(e.target.value);
                          if (e.target.value === emailSecondary) setEmailSecondary(null);
                        }}
                      >
                        {allEmails.map((e) => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Secondary</p>
                      <select
                        className="w-full text-xs border border-border rounded px-1.5 py-1 bg-background"
                        value={emailSecondary || ''}
                        onChange={(e) => setEmailSecondary(e.target.value || null)}
                      >
                        <option value="">None</option>
                        {allEmails.filter((e) => e !== (emailPrimary || allEmails[0])).map((e) => (
                          <option key={e} value={e}>{e}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
              {showPhonePicker && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Choose phones to keep:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Primary</p>
                      <select
                        className="w-full text-xs border border-border rounded px-1.5 py-1 bg-background"
                        value={phonePrimary || allPhones[0]}
                        onChange={(e) => {
                          setPhonePrimary(e.target.value);
                          if (e.target.value === phoneSecondary) setPhoneSecondary(null);
                        }}
                      >
                        {allPhones.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Secondary</p>
                      <select
                        className="w-full text-xs border border-border rounded px-1.5 py-1 bg-background"
                        value={phoneSecondary || ''}
                        onChange={(e) => setPhoneSecondary(e.target.value || null)}
                      >
                        <option value="">None</option>
                        {allPhones.filter((p) => p !== (phonePrimary || allPhones[0])).map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="p-3 border-t border-border/50 bg-muted/10 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              The kept contact will inherit all meetings, 1-on-1s, and organizations from the others.
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

interface MergeDuplicatesDialogProps {
  contacts: ContactWithOrganization[];
  onMerged: (survivorId: number, removedIds: number[]) => void;
}

export default function MergeDuplicatesDialog({ contacts, onMerged }: MergeDuplicatesDialogProps) {
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => findDuplicateGroups(contacts), [contacts]);

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
          <DialogTitle>Merge duplicate contacts</DialogTitle>
          <DialogDescription>
            {groups.length} group{groups.length !== 1 ? 's' : ''} of potential duplicates found. Select which contact to keep — the others will be merged into it.
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
