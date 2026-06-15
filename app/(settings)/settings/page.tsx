'use client';

import { useState, useEffect, startTransition } from 'react';
import { Button } from '@/components/ui/button';
import { useActionState } from 'react';
import { TeamDataWithMembers, User } from '@/lib/db/schema';
import { removeTeamMember, inviteTeamMember, deleteInvitation, resendInvitation, updateTeamMemberRole, updateTeamName } from '@/app/(login)/actions';
import useSWR from 'swr';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  MoreHorizontal,
  UserX,
  Plus,
  Check,
  Mail
} from 'lucide-react';
import { usePlanLimits } from '@/hooks/use-plan-limits';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { InlineEditField } from '@/app/app/organizations/[id]/inline-edit-field';

type ActionState = {
  error?: string;
  success?: string;
  invitationId?: number;
};

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


function TeamNameSection() {
  const { data: teamData, mutate } = useSWR<TeamDataWithMembers>('/api/team', fetcher);
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const isOwner = user?.role === 'owner';

  const handleSave = async (newName: string) => {
    const formData = new FormData();
    formData.append('name', newName);

    const response = await fetch('/api/team/update-name', {
      method: 'POST',
      body: JSON.stringify({ name: newName }),
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error('Failed to update team name');
    }

    mutate();
  };

  if (!isOwner) {
    return (
      <div className="mb-8 bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-3 text-foreground">Team name</h2>
        <p className="text-base text-foreground">{teamData?.name || 'Unnamed Team'}</p>
      </div>
    );
  }

  return (
    <div className="mb-8 bg-card border border-border rounded-lg p-6">
      <InlineEditField
        label="Team name"
        value={teamData?.name || ''}
        onSave={handleSave}
        placeholder="Enter team name"
      />
    </div>
  );
}


function TeamMembers() {
  const { data: teamData, mutate } = useSWR<TeamDataWithInvitations>(
    '/api/team?includeInvitations=true',
    fetcher
  );
  const { data: user } = useSWR<User>('/api/user', fetcher);

  // Check owner status from team_members.role, not users.role
  const currentUserTeamMember = teamData?.team_members?.find(m => m.user.id === user?.id);
  const isOwner = currentUserTeamMember?.role === 'owner';

  const { canInviteTeamMember, teamMemberLimitMessage, isLoading: limitsLoading } = usePlanLimits();

  const [removeState, removeAction, isRemovePending] = useActionState<
    ActionState,
    FormData
  >(removeTeamMember, {});

  const [inviteState, inviteAction, isInvitePending] = useActionState<
    ActionState,
    FormData
  >(inviteTeamMember, {});

  const [deleteState, deleteAction, isDeletePending] = useActionState<
    ActionState,
    FormData
  >(deleteInvitation, {});

  const [resendState, resendAction, isResendPending] = useActionState<
    ActionState,
    FormData
  >(resendInvitation, {});

  const [updateRoleState, updateRoleAction, isUpdateRolePending] = useActionState<
    ActionState,
    FormData
  >(updateTeamMemberRole, {});

  const [dialogOpen, setDialogOpen] = useState(false);

  // Close dialog after successful invite
  useEffect(() => {
    if (inviteState?.success) {
      mutate();
      // Close dialog after a short delay to show success message
      const timer = setTimeout(() => setDialogOpen(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [inviteState?.success, mutate]);

  // Refresh table after successful invitation deletion
  useEffect(() => {
    if (deleteState?.success) {
      mutate();
    }
  }, [deleteState?.success, mutate]);

  // Refresh table after successful member removal
  useEffect(() => {
    if (removeState?.success) {
      mutate();
    }
  }, [removeState?.success, mutate]);

  // Refresh table after successful role update
  useEffect(() => {
    if (updateRoleState?.success) {
      mutate();
    }
  }, [updateRoleState?.success, mutate]);

  const getUserDisplayName = (user: Pick<User, 'id' | 'name' | 'email'>) => {
    return user.name || user.email || 'Unknown User';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleInvite = async (formData: FormData) => {
    await inviteAction(formData);
    if (!inviteState?.error) {
      // Refresh the data to show the new invitation
      mutate();
    }
  };

  const handleDelete = async (formData: FormData) => {
    await deleteAction(formData);
    // useEffect handles mutate on success
  };

  const handleRoleChange = (memberId: number, newRole: string) => {
    const formData = new FormData();
    formData.append('memberId', memberId.toString());
    formData.append('role', newRole);
    startTransition(() => {
      updateRoleAction(formData);
    });
    // useEffect handles mutate on success
  };

  // Combine team members and invitations into a single list
  const allMembers = [
    ...(teamData?.team_members?.map(member => ({
      type: 'member' as const,
      id: member.id,
      email: member.user.email,
      name: getUserDisplayName(member.user),
      role: member.role,
      user_id: member.user.id
    })) || []),
    ...(teamData?.invitations?.map(invitation => ({
      type: 'invitation' as const,
      id: invitation.id,
      email: invitation.email,
      name: invitation.email,
      role: 'invited',
      invitationId: invitation.id,
      invitedRole: invitation.role
    })) || [])
  ];

  // Render invite button with upgrade popover if at limit
  const renderInviteButton = () => {
    // Non-owners see disabled button
    if (!isOwner) {
      return (
        <Button size="sm" disabled>
          <Plus className="mr-2 h-4 w-4" />
          Invite
        </Button>
      );
    }

    // Normal invite button with dialog
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button size="sm" disabled={limitsLoading}>
            <Plus className="mr-2 h-4 w-4" />
            Invite
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Invite team member</DialogTitle>
            <DialogDescription>
              Send an invitation email to add a new member to your team.
            </DialogDescription>
          </DialogHeader>
          <form action={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="colleague@company.com"
                required
                disabled={isInvitePending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select name="role" defaultValue="member" disabled={isInvitePending}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {inviteState?.error && (
              <p className="text-destructive text-sm">{inviteState.error}</p>
            )}
            {inviteState?.success && (
              <p className="text-green-600 text-sm">{inviteState.success}</p>
            )}
            <DialogFooter>
              <Button
                type="submit"
                disabled={isInvitePending || !!inviteState?.success}
                className="w-full"
              >
                {isInvitePending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : inviteState?.success ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Sent!
                  </>
                ) : (
                  'Send invitation'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-foreground">Team members</h2>
        {renderInviteButton()}
      </div>

      {!isOwner && (
        <p className="text-sm text-muted-foreground">
          You must be a team owner to manage team members.
        </p>
      )}

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allMembers.map((member, index) => (
              <TableRow key={`${member.type}-${member.id}`}>
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{member.name}</div>
                      {member.name !== member.email && (
                        <div className="text-sm text-muted-foreground">{member.email}</div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {member.type === 'member' ? (
                    <Select 
                      value={member.role} 
                      disabled={!isOwner || member.user_id === user?.id || isUpdateRolePending}
                      onValueChange={(newRole) => handleRoleChange(member.id, newRole)}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-sm px-2 py-1 bg-muted rounded">Invited</span>
                  )}
                </TableCell>
                <TableCell>
                  {(isOwner && (member.type === 'invitation' || member.user_id !== user?.id)) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {member.type === 'member' ? (
                          <form action={removeAction}>
                            <input type="hidden" name="memberId" value={member.id} />
                            <DropdownMenuItem asChild>
                              <button
                                type="submit"
                                className="w-full text-left cursor-pointer"
                                disabled={isRemovePending}
                              >
                                <UserX className="mr-2 h-4 w-4" />
                                Remove member
                              </button>
                            </DropdownMenuItem>
                          </form>
                        ) : (
                          <>
                            <form action={resendAction}>
                              <input type="hidden" name="invitationId" value={member.invitationId} />
                              <DropdownMenuItem asChild>
                                <button
                                  type="submit"
                                  className="w-full text-left cursor-pointer"
                                  disabled={isResendPending}
                                >
                                  <Mail className="mr-2 h-4 w-4" />
                                  Resend invite
                                </button>
                              </DropdownMenuItem>
                            </form>
                            <form action={handleDelete}>
                              <input type="hidden" name="invitationId" value={member.invitationId} />
                              <DropdownMenuItem asChild>
                                <button
                                  type="submit"
                                  className="w-full text-left cursor-pointer text-destructive"
                                  disabled={isDeletePending}
                                >
                                  <UserX className="mr-2 h-4 w-4" />
                                  Cancel invitation
                                </button>
                              </DropdownMenuItem>
                            </form>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {removeState?.error && (
        <p className="text-destructive text-sm">{removeState.error}</p>
      )}
      {deleteState?.error && (
        <p className="text-destructive text-sm">{deleteState.error}</p>
      )}
      {resendState?.error && (
        <p className="text-destructive text-sm">{resendState.error}</p>
      )}
      {resendState?.success && (
        <p className="text-green-600 text-sm">{resendState.success}</p>
      )}
      {updateRoleState?.error && (
        <p className="text-destructive text-sm">{updateRoleState.error}</p>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <section className="max-w-6xl">
      <h1 className="text-3xl font-bold mb-10 text-foreground">Team settings</h1>
      <TeamNameSection />
      <TeamMembers />
    </section>
  );
}