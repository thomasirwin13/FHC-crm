'use server';

import { z } from 'zod';
import { ActivityType } from '@/lib/db/schema';
import { redirect } from 'next/navigation';
import { getUser, getUserWithTeam, countTeamMembersAndInvitations, getTeamById, hardDeleteUserAndTeam } from '@/lib/db/supabase-queries';
import { getPlanLimits } from '@/lib/plans/limits';
import {
  validatedAction,
  validatedActionWithUser
} from '@/lib/auth/middleware';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getURL } from '@/lib/utils';
import { teamRoleSchema } from '@/lib/constants/role';

async function logActivity(
  teamId: number | null | undefined,
  userId: number,
  type: ActivityType,
  ipAddress?: string
) {
  if (teamId === null || teamId === undefined) {
    return;
  }
  // Use admin client since this may be called during auth flows before session exists
  const adminSupabase = createAdminClient();

  const { error } = await adminSupabase
    .from('activity_logs')
    .insert({
      team_id: teamId,
      user_id: userId,
      action: type,
      ip_address: ipAddress || ''
    });

  if (error) {
    console.error('Error logging activity:', error);
  }
}

const signInSchema = z.object({
  email: z.string().email().min(3).max(255),
  password: z.string().min(8).max(100)
});

export const signIn = validatedAction(signInSchema, async (data, formData) => {
  const { email, password } = data;

  const supabase = await createClient();

  // Sign in with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    return {
      error: 'Invalid email or password. Please try again.',
      email,
      password
    };
  }

  // Get the app user and team info for activity logging
  // Use admin client since we're in the auth flow
  const adminSupabase = createAdminClient();

  const { data: userWithTeam, error: userError } = await adminSupabase
    .from('users')
    .select(`
      *,
      team_members!inner(
        team_id,
        team:teams(*)
      )
    `)
    .eq('supabase_auth_id', authData.user.id)
    .limit(1)
    .single();

  if (!userError && userWithTeam) {
    const teamId = userWithTeam.team_members?.[0]?.team_id;
    const team = userWithTeam.team_members?.[0]?.team;
    await logActivity(teamId, userWithTeam.id, ActivityType.SIGN_IN);

  }

  redirect('/app');
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  inviteId: z.string().optional()
});

export const signUp = validatedAction(signUpSchema, async (data, formData) => {
  const { email, password, inviteId } = data;

  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  // Check if user already exists in our app - use admin client since no session yet
  const { data: existingUser } = await adminSupabase
    .from('users')
    .select('id')
    .eq('email', email)
    .limit(1)
    .single();

  if (existingUser) {
    return {
      error: 'An account with this email already exists.',
      email,
      password
    };
  }

  // Sign up with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError || !authData.user) {
    return {
      error: authError?.message || 'Failed to create account. Please try again.',
      email,
      password
    };
  }

  // Create the app user, team, and team member - use admin client since no session yet
  const supabaseUserId = authData.user.id;

  // Create the app user linked to Supabase Auth
  const { data: createdUser, error: userCreateError } = await adminSupabase
    .from('users')
    .insert({
      email,
      supabase_auth_id: supabaseUserId,
      password_hash: null, // No longer storing passwords locally
      role: 'owner' // Default role, will be overridden if there's an invitation
    })
    .select()
    .single();

  if (userCreateError || !createdUser) {
    return { error: 'Failed to create user. Please try again.', email, password };
  }

  let teamId: number;
  let userRole: string;
  let createdTeam: any = null;

  if (inviteId) {
    // Check if there's a valid invitation
    const { data: invitation } = await adminSupabase
      .from('invitations')
      .select('*')
      .eq('id', parseInt(inviteId))
      .eq('email', email)
      .eq('status', 'pending')
      .limit(1)
      .single();

    if (invitation) {
      teamId = invitation.team_id;
      userRole = invitation.role;

      await adminSupabase
        .from('invitations')
        .update({ status: 'accepted' })
        .eq('id', invitation.id);

      const { data: team } = await adminSupabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      createdTeam = team;
    } else {
      return { error: 'Invalid or expired invitation.', email, password };
    }
  } else {
    // Create a new team if there's no invitation
    const { data: newTeam, error: teamCreateError } = await adminSupabase
      .from('teams')
      .insert({
        name: `${email}'s Team`
      })
      .select()
      .single();

    if (teamCreateError || !newTeam) {
      return { error: 'Failed to create team. Please try again.', email, password };
    }

    createdTeam = newTeam;
    teamId = newTeam.id;
    userRole = 'owner';

  }

  // Create team member
  const { error: teamMemberError } = await adminSupabase
    .from('team_members')
    .insert({
      user_id: createdUser.id,
      team_id: teamId,
      role: userRole
    });

  if (teamMemberError) {
    return { error: 'Failed to add user to team. Please try again.', email, password };
  }

  // Log activities after successful user creation
  if (inviteId) {
    await logActivity(teamId, createdUser.id, ActivityType.ACCEPT_INVITATION);
  } else {
    await logActivity(teamId, createdUser.id, ActivityType.CREATE_TEAM);
  }
  await logActivity(teamId, createdUser.id, ActivityType.SIGN_UP);

  // Return success message for email confirmation
  return {
    success: 'Account created! Please check your email and click the confirmation link to sign in.'
  };
});

export async function signOut() {
  const supabase = await createClient();
  const user = await getUser();

  if (user) {
    const userWithTeam = await getUserWithTeam(user.id);
    const teamId = userWithTeam?.team_members?.[0]?.team_id;
    await logActivity(teamId, user.id, ActivityType.SIGN_OUT);
  }

  await supabase.auth.signOut();
}

const forgotPasswordSchema = z.object({
  email: z.string().email().min(3).max(255)
});

export const forgotPassword = validatedAction(forgotPasswordSchema, async (data) => {
  const { email } = data;
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getURL()}auth/callback?next=/reset-password`,
  });

  if (error) {
    return {
      error: error.message,
      email
    };
  }

  return {
    success: 'If an account exists with this email, you will receive a password reset link.',
    email
  };
});

const resetPasswordSchema = z.object({
  password: z.string().min(8).max(100),
  confirmPassword: z.string().min(8).max(100)
});

export const resetPassword = validatedAction(resetPasswordSchema, async (data) => {
  const { password, confirmPassword } = data;

  if (password !== confirmPassword) {
    return {
      error: 'Passwords do not match.',
      password,
      confirmPassword
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password
  });

  if (error) {
    return {
      error: error.message,
      password,
      confirmPassword
    };
  }

  redirect('/app');
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(100),
  newPassword: z.string().min(8).max(100),
  confirmPassword: z.string().min(8).max(100)
});

export const updatePassword = validatedActionWithUser(
  updatePasswordSchema,
  async (data, _, user) => {
    const { currentPassword, newPassword, confirmPassword } = data;

    if (currentPassword === newPassword) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: 'New password must be different from the current password.'
      };
    }

    if (confirmPassword !== newPassword) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: 'New password and confirmation password do not match.'
      };
    }

    const supabase = await createClient();

    // Verify current password by attempting to sign in
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (verifyError) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: 'Current password is incorrect.'
      };
    }

    // Update password in Supabase Auth
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (updateError) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: updateError.message || 'Failed to update password.'
      };
    }

    const userWithTeam = await getUserWithTeam(user.id);
    const teamId = userWithTeam?.team_members?.[0]?.team_id;
    await logActivity(teamId, user.id, ActivityType.UPDATE_PASSWORD);

    return {
      success: 'Password updated successfully.'
    };
  }
);

const deleteAccountSchema = z.object({
  password: z.string().optional(),
  confirmation: z.string().optional(),
});

export const deleteAccount = validatedActionWithUser(
  deleteAccountSchema,
  async (data, _, user) => {
    const { password, confirmation } = data;

    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // Determine if user has a password (email/password auth) or is OAuth-only
    const hasPassword = user.supabase_auth_id
      ? await (async () => {
          const { data: authUser } = await adminSupabase.auth.admin.getUserById(user.supabase_auth_id!);
          // If user has identities with provider 'email', they have a password
          return authUser?.user?.identities?.some(i => i.provider === 'email') ?? false;
        })()
      : false;

    if (hasPassword) {
      // Password-based user: verify password
      if (!password || password.length < 8) {
        return { error: 'Please enter your password to confirm deletion.' };
      }

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (verifyError) {
        return { error: 'Incorrect password. Account deletion failed.' };
      }
    } else {
      // OAuth-only user: require typing "DELETE"
      if (confirmation !== 'DELETE') {
        return { error: 'Please type DELETE to confirm account deletion.' };
      }
    }

    const userWithTeam = await getUserWithTeam(user.id);
    const teamId = userWithTeam?.team_members?.[0]?.team_id;

    if (!teamId) {
      return { error: 'Could not find your team. Please contact support.' };
    }

    // Check if other members exist on this team
    const { count: memberCount } = await adminSupabase
      .from('team_members')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId);

    if (memberCount && memberCount > 1) {
      return {
        error: 'Your team has other members. Please remove them or transfer ownership before deleting your account.'
      };
    }

    // Hard delete user, team, and all team data
    try {
      await hardDeleteUserAndTeam(
        adminSupabase,
        user.id,
        teamId,
        user.supabase_auth_id
      );
    } catch (deleteError) {
      console.error('Error during hard delete:', deleteError);
      return { error: 'Failed to delete account. Please contact support.' };
    }

    // Sign out (may fail since auth user was already deleted)
    try {
      await supabase.auth.signOut();
    } catch {
      // Auth user already deleted, session is invalid
    }
    redirect('/sign-in');
  }
);

const updateAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address')
});

export const updateAccount = validatedActionWithUser(
  updateAccountSchema,
  async (data, _, user) => {
    const { name, email } = data;
    const supabase = await createClient();
    const userWithTeam = await getUserWithTeam(user.id);
    const teamId = userWithTeam?.team_members?.[0]?.team_id;

    const { error } = await supabase
      .from('users')
      .update({ name, email })
      .eq('id', user.id);

    if (error) {
      return { error: 'Failed to update account.' };
    }

    await logActivity(teamId, user.id, ActivityType.UPDATE_ACCOUNT);

    return { name, success: 'Account updated successfully.' };
  }
);

const removeTeamMemberSchema = z.object({
  memberId: z.coerce.number()
});

export const removeTeamMember = validatedActionWithUser(
  removeTeamMemberSchema,
  async (data, _, user) => {
    const { memberId } = data;
    const supabase = await createClient();
    const userWithTeam = await getUserWithTeam(user.id);
    const teamId = userWithTeam?.team_members?.[0]?.team_id;
    const userRole = userWithTeam?.team_members?.[0]?.role;

    if (!teamId) {
      return { error: 'User is not part of a team' };
    }

    // Only owners can remove team members
    if (userRole !== 'owner') {
      return { error: 'Only team owners can remove members' };
    }

    // Get the member to be removed to check their role
    const { data: memberToRemove } = await supabase
      .from('team_members')
      .select('user_id, role')
      .eq('id', memberId)
      .eq('team_id', teamId)
      .single();

    if (!memberToRemove) {
      return { error: 'Member not found' };
    }

    // Prevent removing yourself
    if (memberToRemove.user_id === user.id) {
      return { error: 'You cannot remove yourself from the team' };
    }

    // Prevent removing the last owner
    if (memberToRemove.role === 'owner') {
      const { count: ownerCount } = await supabase
        .from('team_members')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('role', 'owner');

      if (ownerCount === 1) {
        return { error: 'Cannot remove the last owner. Transfer ownership first.' };
      }
    }

    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId)
      .eq('team_id', teamId);

    if (error) {
      return { error: 'Failed to remove team member' };
    }

    await logActivity(
      teamId,
      user.id,
      ActivityType.REMOVE_TEAM_MEMBER
    );

    return { success: 'Team member removed successfully' };
  }
);

const inviteTeamMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: teamRoleSchema,
});

export const inviteTeamMember = validatedActionWithUser(
  inviteTeamMemberSchema,
  async (data, _, user) => {
    const { email, role } = data;
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const userWithTeam = await getUserWithTeam(user.id);
    const teamId = userWithTeam?.team_members?.[0]?.team_id;
    const userRole = userWithTeam?.team_members?.[0]?.role;

    if (!teamId) {
      return { error: 'User is not part of a team' };
    }

    // Only owners can invite team members
    if (userRole !== 'owner') {
      return { error: 'Only team owners can invite new members' };
    }

    // Check plan limits
    const team = await getTeamById(teamId);
    const memberCount = await countTeamMembersAndInvitations(teamId);
    const limits = getPlanLimits(team?.plan_name || null);
    if (memberCount >= limits.maxTeamMembers) {
      return { error: `You've reached your ${team?.plan_name || 'Free'} plan limit of ${limits.maxTeamMembers} team members. Upgrade to invite more.` };
    }

    // Check if user is already a member of this team
    const { data: existingMember } = await supabase
      .from('team_members')
      .select(`
        id,
        user:users!inner(email)
      `)
      .eq('team_id', teamId)
      .eq('users.email', email)
      .limit(1)
      .single();

    if (existingMember) {
      return { error: 'User is already a member of this team' };
    }

    // Check if user already exists in our app (e.g., was previously removed from team)
    const { data: existingAppUser } = await adminSupabase
      .from('users')
      .select('id')
      .eq('email', email)
      .is('deleted_at', null)
      .limit(1)
      .single();

    // If user exists but is not on this team, add them directly
    if (existingAppUser) {
      const { error: addMemberError } = await adminSupabase
        .from('team_members')
        .insert({
          user_id: existingAppUser.id,
          team_id: teamId,
          role,
        });

      if (addMemberError) {
        return { error: 'Failed to add user to team' };
      }

      await logActivity(
        teamId,
        user.id,
        ActivityType.INVITE_TEAM_MEMBER
      );

      return { success: 'User added to team successfully' };
    }

    // Check if there's an existing invitation
    const { data: existingInvitation } = await supabase
      .from('invitations')
      .select('id')
      .eq('email', email)
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .limit(1)
      .single();

    if (existingInvitation) {
      return { error: 'An invitation has already been sent to this email' };
    }

    // Use Supabase Admin API to invite user (sends email automatically)
    const { data: inviteData, error: supabaseInviteError } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${getURL()}auth/callback?next=/app`,
      data: {
        inviter_name: user.name || user.email,
        inviter_email: user.email,
        team_name: team?.name || 'the team',
      },
    });

    if (supabaseInviteError || !inviteData.user) {
      console.error('Supabase invite error:', supabaseInviteError);
      return { error: supabaseInviteError?.message || 'Failed to send invitation email' };
    }

    // Create invitation record with supabase_user_id
    const { data: invitation, error: inviteError } = await adminSupabase
      .from('invitations')
      .insert({
        team_id: teamId,
        email,
        role,
        invited_by: user.id,
        status: 'pending',
        supabase_user_id: inviteData.user.id
      })
      .select()
      .single();

    if (inviteError || !invitation) {
      // Clean up the Supabase auth user if we failed to create the invitation record
      await adminSupabase.auth.admin.deleteUser(inviteData.user.id);
      return { error: 'Failed to create invitation' };
    }

    await logActivity(
      teamId,
      user.id,
      ActivityType.INVITE_TEAM_MEMBER
    );

    return {
      success: 'Invitation sent successfully',
      invitationId: invitation.id
    };
  }
);

const deleteInvitationSchema = z.object({
  invitationId: z.coerce.number()
});

export const deleteInvitation = validatedActionWithUser(
  deleteInvitationSchema,
  async (data, _, user) => {
    const { invitationId } = data;
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const userWithTeam = await getUserWithTeam(user.id);
    const teamId = userWithTeam?.team_members?.[0]?.team_id;
    const userRole = userWithTeam?.team_members?.[0]?.role;

    if (!teamId) {
      return { error: 'User is not part of a team' };
    }

    // Only owners can delete invitations
    if (userRole !== 'owner') {
      return { error: 'Only team owners can delete invitations' };
    }

    // Verify the invitation belongs to the user's team and get supabase_user_id
    const { data: invitation } = await supabase
      .from('invitations')
      .select('id, supabase_user_id')
      .eq('id', invitationId)
      .eq('team_id', teamId)
      .limit(1)
      .single();

    if (!invitation) {
      return { error: 'Invitation not found' };
    }

    // Delete the pending Supabase auth user if it exists
    if (invitation.supabase_user_id) {
      const { error: deleteAuthError } = await adminSupabase.auth.admin.deleteUser(invitation.supabase_user_id);
      if (deleteAuthError) {
        console.error('Failed to delete Supabase auth user:', deleteAuthError);
        // Continue anyway - the invitation record should still be deleted
      }
    }

    // Delete the invitation
    const { error } = await supabase
      .from('invitations')
      .delete()
      .eq('id', invitationId);

    if (error) {
      return { error: 'Failed to delete invitation' };
    }

    await logActivity(
      teamId,
      user.id,
      ActivityType.REMOVE_TEAM_MEMBER
    );

    return { success: 'Invitation deleted successfully' };
  }
);

const resendInvitationSchema = z.object({
  invitationId: z.coerce.number()
});

export const resendInvitation = validatedActionWithUser(
  resendInvitationSchema,
  async (data, _, user) => {
    const { invitationId } = data;
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const userWithTeam = await getUserWithTeam(user.id);
    const teamId = userWithTeam?.team_members?.[0]?.team_id;
    const userRole = userWithTeam?.team_members?.[0]?.role;

    if (!teamId) {
      return { error: 'User is not part of a team' };
    }

    // Only owners can resend invitations
    if (userRole !== 'owner') {
      return { error: 'Only team owners can resend invitations' };
    }

    // Get the invitation
    const { data: invitation } = await supabase
      .from('invitations')
      .select('*')
      .eq('id', invitationId)
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .limit(1)
      .single();

    if (!invitation) {
      return { error: 'Invitation not found' };
    }

    // Delete the old Supabase auth user if it exists
    if (invitation.supabase_user_id) {
      await adminSupabase.auth.admin.deleteUser(invitation.supabase_user_id);
    }

    // Get team name for the email
    const team = await getTeamById(teamId);

    // Create a new invite
    const { data: inviteData, error: supabaseInviteError } = await adminSupabase.auth.admin.inviteUserByEmail(invitation.email, {
      redirectTo: `${getURL()}auth/callback?next=/app`,
      data: {
        inviter_name: user.name || user.email,
        inviter_email: user.email,
        team_name: team?.name || 'the team',
      },
    });

    if (supabaseInviteError || !inviteData.user) {
      console.error('Supabase invite error:', supabaseInviteError);
      return { error: supabaseInviteError?.message || 'Failed to resend invitation' };
    }

    // Update the invitation with the new supabase_user_id
    const { error: updateError } = await adminSupabase
      .from('invitations')
      .update({
        supabase_user_id: inviteData.user.id,
        invited_at: new Date().toISOString(),
      })
      .eq('id', invitationId);

    if (updateError) {
      return { error: 'Failed to update invitation' };
    }

    await logActivity(
      teamId,
      user.id,
      ActivityType.INVITE_TEAM_MEMBER
    );

    return { success: 'Invitation resent successfully' };
  }
);

const updateTeamMemberRoleSchema = z.object({
  memberId: z.coerce.number(),
  role: teamRoleSchema,
});

export const updateTeamMemberRole = validatedActionWithUser(
  updateTeamMemberRoleSchema,
  async (data, _, user) => {
    const { memberId, role } = data;
    const supabase = await createClient();
    const userWithTeam = await getUserWithTeam(user.id);
    const teamId = userWithTeam?.team_members?.[0]?.team_id;

    if (!teamId) {
      return { error: 'User is not part of a team' };
    }

    // Only owners can update roles
    const { data: currentUserMember } = await supabase
      .from('team_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('team_id', teamId)
      .limit(1)
      .single();

    if (currentUserMember?.role !== 'owner') {
      return { error: 'Only owners can update member roles' };
    }

    // Verify the member belongs to the same team and get current role
    const { data: targetMember } = await supabase
      .from('team_members')
      .select('id, role')
      .eq('id', memberId)
      .eq('team_id', teamId)
      .limit(1)
      .single();

    if (!targetMember) {
      return { error: 'Member not found' };
    }

    // Prevent demoting the last owner
    if (role !== 'owner' && targetMember.role === 'owner') {
      const { count: ownerCount } = await supabase
        .from('team_members')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('role', 'owner');

      if (ownerCount === 1) {
        return { error: 'Cannot demote the last owner. Promote another member first.' };
      }
    }

    // Update the member's role
    const { error } = await supabase
      .from('team_members')
      .update({ role })
      .eq('id', memberId);

    if (error) {
      return { error: 'Failed to update role' };
    }

    await logActivity(
      teamId,
      user.id,
      ActivityType.UPDATE_ACCOUNT
    );

    return { success: 'Role updated successfully' };
  }
);

const updateTeamNameSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100, 'Team name is too long')
});

export const updateTeamName = validatedActionWithUser(
  updateTeamNameSchema,
  async (data, _, user) => {
    const { name } = data;
    const supabase = await createClient();
    const userWithTeam = await getUserWithTeam(user.id);
    const teamId = userWithTeam?.team_members?.[0]?.team_id;
    const userRole = userWithTeam?.team_members?.[0]?.role;

    if (!teamId) {
      return { error: 'User is not part of a team' };
    }

    // Only owners can update team name
    if (userRole !== 'owner') {
      return { error: 'Only team owners can update the team name' };
    }

    const { error } = await supabase
      .from('teams')
      .update({ name })
      .eq('id', teamId);

    if (error) {
      return { error: 'Failed to update team name' };
    }

    await logActivity(
      teamId,
      user.id,
      ActivityType.UPDATE_ACCOUNT
    );

    return { success: 'Team name updated successfully' };
  }
);
