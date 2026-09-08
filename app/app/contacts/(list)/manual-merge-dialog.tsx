'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { mergeContactsAction } from '@/app/app/contacts/merge-actions';
import { ContactWithOrganization } from '@/lib/db/supabase-queries';

interface ManualMergeContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: ContactWithOrganization[];
  onMerged: (survivorId: number, removedIds: number[]) => void;
}

export default function ManualMergeContactsDialog({
  open,
  onOpenChange,
  contacts,
  onMerged,
}: ManualMergeContactsDialogProps) {
  const [primaryId, setPrimaryId] = useState(contacts[0]?.id);
  const [merging, setMerging] = useState(false);
  const [emailPrimary, setEmailPrimary] = useState<string | null>(null);
  const [emailSecondary, setEmailSecondary] = useState<string | null>(null);
  const [phonePrimary, setPhonePrimary] = useState<string | null>(null);
  const [phoneSecondary, setPhoneSecondary] = useState<string | null>(null);

  const duplicateIds = contacts.filter((c) => c.id !== primaryId).map((c) => c.id);

  const allEmails = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((c) => {
      if (c.email) set.add(c.email);
      if ((c as any).email_secondary) set.add((c as any).email_secondary);
    });
    return Array.from(set);
  }, [contacts]);

  const allPhones = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((c) => {
      if (c.phone) set.add(c.phone);
      if ((c as any).phone_secondary) set.add((c as any).phone_secondary);
    });
    return Array.from(set);
  }, [contacts]);

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
      onMerged(primaryId, duplicateIds);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge {contacts.length} contacts</DialogTitle>
          <DialogDescription>
            Select which contact to keep — the others will be merged into it and their data transferred.
          </DialogDescription>
        </DialogHeader>
        <div className="divide-y divide-border/50 border border-border/50 rounded-lg overflow-hidden">
          {contacts.map((contact) => (
            <label
              key={contact.id}
              className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/20 transition-colors"
            >
              <input
                type="radio"
                name="primary-manual-contact"
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
                  {(contact as any).organization?.name && <span>· {(contact as any).organization.name}</span>}
                </div>
              </div>
            </label>
          ))}
        </div>
        {/* Email/phone picker when multiple exist */}
        {(showEmailPicker || showPhonePicker) && (
          <div className="border border-border/50 rounded-lg p-3 space-y-2">
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
                      {allEmails.map((em) => <option key={em} value={em}>{em}</option>)}
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
                      {allEmails.filter((em) => em !== (emailPrimary || allEmails[0])).map((em) => (
                        <option key={em} value={em}>{em}</option>
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
                      {allPhones.map((ph) => <option key={ph} value={ph}>{ph}</option>)}
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
                      {allPhones.filter((ph) => ph !== (phonePrimary || allPhones[0])).map((ph) => (
                        <option key={ph} value={ph}>{ph}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 pt-2">
          <p className="text-xs text-muted-foreground">
            The kept contact will inherit all data from the others.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={merging}>
              Cancel
            </Button>
            <Button onClick={handleMerge} disabled={merging}>
              {merging ? 'Merging…' : 'Merge'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
