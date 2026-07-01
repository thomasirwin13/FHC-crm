'use client';

import { useState, useTransition } from 'react';
import { TeamDataWithMembers, User } from '@/lib/db/schema';
import { removeTeamMember, inviteTeamMember, deleteInvitation, resendInvitation, updateTeamMemberRole, updateTeamName } from '@/app/(login)/actions';
import useSWR from 'swr';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Loader2, MoreHorizontal, UserX, Plus, Check, Mail, RefreshCw,
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { InlineEditField } from '@/app/app/organizations/[id]/inline-edit-field';
import { toast } from 'sonner';

type TeamDataWithInvitations = TeamDataWithMembers & {
  invitations?: Array<{
    id: number;
    email: string;
    role: string;
    invited_at: Date;
    invited_by: number;
  }>;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function TeamNameSection() {
  const { data: teamData, mutate } = useSWR<TeamDataWithMembers>('/api/team', fetcher);
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const isOwner = user?.role === 'owner';

  const handleSave = async (newName: string) => {
    const response = await fetch('/api/team/update-name', {
      method: 'POST',
      body: JSON.stringify({ name: newName }),
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Failed to update team name');
    mutate();
    toast.success('Team name updated');
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      {isOwner ? (
        <InlineEditField
          label="Team name"
          value={teamData?.name || ''}
          onSave={handleSave}
          placeholder="Enter team name"
        />
      ) : (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Team name</p>
          <p className="text-base font-medium">{teamData?.name || 'Unnamed Team'}</p>
        </div>
      )}
    </div>
  );
}

function InviteDialog({ onInvited }: { onInvited: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const fd = new FormData();
    fd.append('email', email);
    fd.append('role', role);
    startTransition(async () => {
      const result = await inviteTeamMember({}, fd);
      if ('error' in result && result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        toast.success('Invitation sent');
        onInvited();
        setTimeout(() => {
          setOpen(false);
          setEmail('');
          setRole('member');
          setSuccess(false);
          setError('');
        }, 1200);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEmail(''); setRole('member'); setError(''); setSuccess(false); } }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-2 h-4 w-4" />Invite member</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Invite team member</DialogTitle>
          <DialogDescription>
            Send an invitation to add someone to your team. They'll receive an email with a link to join.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isPending || success}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={setRole} disabled={isPending || success}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member — can view and edit data</SelectItem>
                <SelectItem value="owner">Owner — can also manage team members</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending || success} className="w-full">
              {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</> :
               success  ? <><Check className="mr-2 h-4 w-4" />Sent!</> :
               'Send invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TeamMembers() {
  const { data: teamData, mutate, isLoading } = useSWR<TeamDataWithInvitations>(
    '/api/team?includeInvitations=true', fetcher, { revalidateOnFocus: false }
  );
  const { data: user } = useSWR<User>('/api/user', fetcher);

  const currentUserMember = teamData?.team_members?.find((m) => m.user.id === user?.id);
  const isOwner = currentUserMember?.role === 'owner';

  const [, startTransition] = useTransition();

  const doAction = (action: () => Promise<any>, successMsg: string) => {
    startTransition(async () => {
      const result = await action();
      if ('error' in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success(successMsg);
        mutate();
      }
    });
  };

  const handleRemove = (memberId: number) => {
    const fd = new FormData();
    fd.append('memberId', memberId.toString());
    doAction(() => removeTeamMember({}, fd), 'Member removed');
  };

  const handleRoleChange = (memberId: number, newRole: string) => {
    const fd = new FormData();
    fd.append('memberId', memberId.toString());
    fd.append('role', newRole);
    doAction(() => updateTeamMemberRole({}, fd), 'Role updated');
  };

  const handleResend = (invitationId: number) => {
    const fd = new FormData();
    fd.append('invitationId', invitationId.toString());
    doAction(() => resendInvitation({}, fd), 'Invitation resent');
  };

  const handleDeleteInvite = (invitationId: number) => {
    const fd = new FormData();
    fd.append('invitationId', invitationId.toString());
    doAction(() => deleteInvitation({}, fd), 'Invitation cancelled');
  };

  const members = teamData?.team_members ?? [];
  const invitations = teamData?.invitations ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Team members</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {members.length} member{members.length !== 1 ? 's' : ''}
            {invitations.length > 0 && `, ${invitations.length} pending invite${invitations.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {isOwner && <InviteDialog onInvited={() => mutate()} />}
      </div>

      {!isOwner && (
        <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg px-4 py-3">
          Only team owners can invite or remove members.
        </p>
      )}

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Member</TableHead>
              <TableHead className="w-36">Role</TableHead>
              {isOwner && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…
                </TableCell>
              </TableRow>
            )}

            {/* Active members */}
            {members.map((member) => {
              const displayName = member.user.name || member.user.email;
              const isSelf = member.user.id === user?.id;
              return (
                <TableRow key={`member-${member.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                          {getInitials(displayName || '?')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">
                          {displayName}{isSelf && <span className="text-muted-foreground font-normal"> (you)</span>}
                        </div>
                        {member.user.name && (
                          <div className="text-xs text-muted-foreground truncate">{member.user.email}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isOwner && !isSelf ? (
                      <Select
                        value={member.role}
                        onValueChange={(val) => handleRoleChange(member.id, val)}
                      >
                        <SelectTrigger className="h-8 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">Owner</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className="text-xs capitalize">{member.role}</Badge>
                    )}
                  </TableCell>
                  {isOwner && (
                    <TableCell>
                      {!isSelf && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleRemove(member.id)}
                            >
                              <UserX className="mr-2 h-4 w-4" />Remove from team
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}

            {/* Pending invitations */}
            {invitations.map((inv) => (
              <TableRow key={`inv-${inv.id}`} className="bg-muted/20">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                        {getInitials(inv.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="text-sm truncate text-muted-foreground">{inv.email}</div>
                      <div className="text-xs text-muted-foreground">Invite pending</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs capitalize">{inv.role}</Badge>
                </TableCell>
                {isOwner && (
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleResend(inv.id)}>
                          <RefreshCw className="mr-2 h-4 w-4" />Resend invite
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDeleteInvite(inv.id)}
                        >
                          <UserX className="mr-2 h-4 w-4" />Cancel invite
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}

            {!isLoading && members.length === 0 && invitations.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground text-sm">
                  No team members yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Invited members will receive an email with a link to join your team. If they already have an account, they'll be added automatically.
      </p>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <section className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold">Team settings</h1>
      <TeamNameSection />
      <TeamMembers />
    </section>
  );
}
