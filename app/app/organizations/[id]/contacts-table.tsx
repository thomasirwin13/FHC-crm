'use client';

import { useState } from 'react';
import { Plus, Trash2, Pencil, X, Check, Loader2, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Contact } from '@/lib/db/schema';
import { createContactAction, updateContactAction, deleteContactAction } from './contact-actions';
import { setTeamLeaderAction } from './actions';
import { LinkContactsDialog } from './link-contacts-dialog';
import { toast } from 'sonner';

const ENGAGEMENT_LABELS: Record<string, string> = {
  potential: 'Potential',
  learner: 'Learner',
  participator: 'Participator',
  attender: 'Attender',
  activist: 'Activist',
};

interface AvailableContact {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  organization?: { id: number; name: string } | null;
}

interface ContactsTableProps {
  contacts: Contact[];
  organizationId: number;
  teamLeaderId?: number | null;
  allTeamContacts?: AvailableContact[];
}

interface EditingState {
  id: number | 'new';
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
}

export function ContactsTable({ contacts: initialContacts, organizationId, teamLeaderId: initialTeamLeaderId, allTeamContacts = [] }: ContactsTableProps) {
  const [contacts, setContacts] = useState(initialContacts);
  const [editing, setEditing] = useState<EditingState | null>(null);

  const linkedIds = new Set(contacts.map((c) => c.id));
  const availableContacts = allTeamContacts.filter((c) => !linkedIds.has(c.id));

  const handleLinked = (newContacts: AvailableContact[]) => {
    // Optimistically add the linked contacts to the list (as Contact-shaped objects)
    setContacts((prev) => [
      ...prev,
      ...newContacts.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email ?? null,
        phone: c.phone ?? null,
        city: null,
        state: null,
        zip: null,
        street: null,
        organization_id: organizationId,
        team_id: 0,
        user_id: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }) as Contact),
    ]);
  };
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [teamLeaderId, setTeamLeaderId] = useState<number | null>(initialTeamLeaderId ?? null);
  const [settingLeaderId, setSettingLeaderId] = useState<number | null>(null);

  const startAdding = () => {
    setEditing({ id: 'new', name: '', email: '', phone: '', city: '', state: '' });
  };

  const startEditing = (contact: Contact) => {
    setEditing({
      id: contact.id,
      name: contact.name,
      email: contact.email || '',
      phone: contact.phone || '',
      city: contact.city || '',
      state: contact.state || '',
    });
  };

  const cancel = () => setEditing(null);

  const handleSetTeamLeader = async (contactId: number) => {
    const newLeaderId = teamLeaderId === contactId ? null : contactId;
    setSettingLeaderId(contactId);
    const result = await setTeamLeaderAction(organizationId, newLeaderId);
    if ('error' in result && result.error) {
      toast.error(result.error);
    } else {
      setTeamLeaderId(newLeaderId);
      toast.success(newLeaderId ? 'Team leader set' : 'Team leader removed');
    }
    setSettingLeaderId(null);
  };

  const save = async () => {
    if (!editing || !editing.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      if (editing.id === 'new') {
        const result = await createContactAction({
          organizationId,
          name: editing.name.trim(),
          email: editing.email.trim() || undefined,
          phone: editing.phone.trim() || undefined,
          city: editing.city.trim() || undefined,
          state: editing.state.trim() || undefined,
        });

        if ('error' in result && result.error) {
          toast.error(result.error);
          return;
        }

        if (result.data) {
          setContacts(prev => [result.data!, ...prev]);
          toast.success('Contact added');
        }
      } else {
        const result = await updateContactAction({
          id: editing.id,
          organizationId,
          name: editing.name.trim(),
          email: editing.email.trim() || undefined,
          phone: editing.phone.trim() || undefined,
          city: editing.city.trim() || undefined,
          state: editing.state.trim() || undefined,
        });

        if ('error' in result && result.error) {
          toast.error(result.error);
          return;
        }

        if (result.data) {
          setContacts(prev => prev.map(c => c.id === editing.id ? result.data! : c));
          toast.success('Contact updated');
        }
      }
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (contactId: number) => {
    setDeletingId(contactId);
    try {
      const result = await deleteContactAction({ id: contactId, organizationId });
      if ('error' in result && result.error) {
        toast.error(result.error);
        return;
      }
      setContacts(prev => prev.filter(c => c.id !== contactId));
      if (teamLeaderId === contactId) setTeamLeaderId(null);
      toast.success('Contact deleted');
      if (editing?.id === contactId) setEditing(null);
    } finally {
      setDeletingId(null);
    }
  };

  const leader = contacts.find(c => c.id === teamLeaderId);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold">Contacts</CardTitle>
          {leader && (
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Crown className="h-3.5 w-3.5 text-amber-500" />
              <span>Team leader: </span>
              <a href={`/app/contacts/${leader.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                {leader.name}
              </a>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <LinkContactsDialog
            organizationId={organizationId}
            availableContacts={availableContacts}
            onLinked={handleLinked}
          />
          <Button size="sm" variant="outline" onClick={startAdding} disabled={editing !== null}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add new
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {contacts.length === 0 && !editing ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No contacts yet. Add one to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left font-medium text-muted-foreground py-2 pr-3">Name</th>
                  <th className="text-left font-medium text-muted-foreground py-2 pr-3">Level</th>
                  <th className="text-left font-medium text-muted-foreground py-2 pr-3">Email</th>
                  <th className="text-left font-medium text-muted-foreground py-2 pr-3">Phone</th>
                  <th className="text-left font-medium text-muted-foreground py-2 pr-3">Location</th>
                  <th className="text-right font-medium text-muted-foreground py-2 w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {editing?.id === 'new' && (
                  <EditRow editing={editing} setEditing={setEditing} onSave={save} onCancel={cancel} saving={saving} />
                )}
                {contacts.map(contact => (
                  editing?.id === contact.id ? (
                    <EditRow key={contact.id} editing={editing} setEditing={setEditing} onSave={save} onCancel={cancel} saving={saving} />
                  ) : (
                    <tr key={contact.id} className="border-b border-border/30 last:border-0">
                      <td className="py-2.5 pr-3 font-medium">
                        <div className="flex items-center gap-1.5">
                          {contact.id === teamLeaderId && (
                            <Crown className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" aria-label="Team leader" />
                          )}
                          <a href={`/app/contacts/${contact.id}`} className="hover:text-primary transition-colors">
                            {contact.name}
                          </a>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge variant="outline" className="text-xs">
                          {ENGAGEMENT_LABELS[(contact as any).engagement_level ?? 'potential'] ?? 'Potential'}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        {contact.email ? (
                          <a href={`mailto:${contact.email}`} className="hover:text-foreground transition-colors">
                            {contact.email}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">{contact.phone || '—'}</td>
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        {[contact.city, contact.state].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className={`h-7 w-7 ${contact.id === teamLeaderId ? 'text-amber-500' : 'text-muted-foreground'}`}
                            onClick={() => handleSetTeamLeader(contact.id)}
                            disabled={settingLeaderId === contact.id}
                            title={contact.id === teamLeaderId ? 'Remove team leader' : 'Set as team leader'}
                          >
                            {settingLeaderId === contact.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Crown className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => startEditing(contact)}
                            disabled={editing !== null}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(contact.id)}
                            disabled={deletingId === contact.id}
                          >
                            {deletingId === contact.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EditRow({
  editing,
  setEditing,
  onSave,
  onCancel,
  saving,
}: {
  editing: EditingState;
  setEditing: (state: EditingState) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const update = (field: keyof EditingState, value: string) => {
    setEditing({ ...editing, [field]: value });
  };

  return (
    <tr className="border-b border-border/30">
      <td className="py-1.5 pr-2" colSpan={2}>
        <Input
          value={editing.name}
          onChange={e => update('name', e.target.value)}
          placeholder="Name *"
          className="h-8 text-sm"
          autoFocus
          onKeyDown={e => e.key === 'Enter' && onSave()}
        />
      </td>
      <td className="py-1.5 pr-2">
        <Input
          value={editing.email}
          onChange={e => update('email', e.target.value)}
          placeholder="Email"
          className="h-8 text-sm"
          onKeyDown={e => e.key === 'Enter' && onSave()}
        />
      </td>
      <td className="py-1.5 pr-2">
        <Input
          value={editing.phone}
          onChange={e => update('phone', e.target.value)}
          placeholder="Phone"
          className="h-8 text-sm"
          onKeyDown={e => e.key === 'Enter' && onSave()}
        />
      </td>
      <td className="py-1.5 pr-2">
        <div className="flex gap-1">
          <Input
            value={editing.city}
            onChange={e => update('city', e.target.value)}
            placeholder="City"
            className="h-8 text-sm"
            onKeyDown={e => e.key === 'Enter' && onSave()}
          />
          <Input
            value={editing.state}
            onChange={e => update('state', e.target.value)}
            placeholder="State"
            className="h-8 text-sm w-20"
            onKeyDown={e => e.key === 'Enter' && onSave()}
          />
        </div>
      </td>
      <td className="py-1.5 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancel} disabled={saving}>
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="default" className="h-7 w-7" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </td>
    </tr>
  );
}
