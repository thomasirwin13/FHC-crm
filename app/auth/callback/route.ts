import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { EmailOtpType } from '@supabase/supabase-js';

function sanitizeRedirectPath(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) {
    return '/app';
  }
  return path;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = sanitizeRedirectPath(searchParams.get('next') ?? '/app');
  const inviteId = searchParams.get('inviteId');

  // Handle errors sent by Supabase (e.g., expired link)
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (error) {
    const errorMessage = errorDescription || error;
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(errorMessage)}`
    );
  }

  const supabase = await createClient();

  // Method 1: token_hash (email confirmation via custom template)
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  if (tokenHash && type) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!verifyError) {
      await handleNewAuthUser(supabase, inviteId);

      // For invites, redirect to set-password page so user can create their password
      if (type === 'invite') {
        return NextResponse.redirect(`${origin}/set-password?next=${encodeURIComponent(next)}`);
      }

      // For password recovery, redirect to the reset-password page
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/reset-password`);
      }

      return redirectToNext(request, origin, next);
    }
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(verifyError.message)}`
    );
  }

  // Method 2: code (password reset, magic link)
  const code = searchParams.get('code');
  if (code) {
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      await handleNewAuthUser(supabase, inviteId);
      return redirectToNext(request, origin, next);
    }
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(exchangeError.message)}`
    );
  }

  // Method 3: Session already established (e.g. Google ID token via signInWithIdToken)
  // No code or token_hash, but user may have a valid session — just provision and redirect
  const { data: { user: sessionUser } } = await supabase.auth.getUser();
  if (sessionUser) {
    await handleNewAuthUser(supabase, inviteId);
    return redirectToNext(request, origin, next);
  }

  // No valid authentication parameters provided
  return NextResponse.redirect(`${origin}/sign-in?error=Invalid+authentication+link`);
}

/**
 * Handle new authenticated users: provision app user, team membership,
 * and default resources. Works for both invited users and brand-new OAuth signups.
 */
async function handleNewAuthUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  inviteId: string | null
) {
  const adminSupabase = createAdminClient();

  // Get the current Supabase auth user
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  if (!supabaseUser) {
    return;
  }

  // Check if app user already exists for this Supabase auth user
  const { data: existingUser } = await adminSupabase
    .from('users')
    .select('id')
    .eq('supabase_auth_id', supabaseUser.id)
    .limit(1)
    .single();

  // Check for a pending invitation by supabase_user_id or email
  let invitation = null;

  const { data: inviteBySupabaseId } = await adminSupabase
    .from('invitations')
    .select('*')
    .eq('supabase_user_id', supabaseUser.id)
    .eq('status', 'pending')
    .limit(1)
    .single();

  if (inviteBySupabaseId) {
    invitation = inviteBySupabaseId;
  } else if (supabaseUser.email) {
    const { data: inviteByEmail } = await adminSupabase
      .from('invitations')
      .select('*')
      .eq('email', supabaseUser.email.toLowerCase())
      .eq('status', 'pending')
      .limit(1)
      .single();
    if (inviteByEmail) invitation = inviteByEmail;
  }

  if (existingUser) {
    // User already provisioned — but if there's a pending invite, add them to that team
    if (invitation) {
      const { data: alreadyOnTeam } = await adminSupabase
        .from('team_members')
        .select('id')
        .eq('user_id', existingUser.id)
        .eq('team_id', invitation.team_id)
        .limit(1)
        .single();

      if (!alreadyOnTeam) {
        await adminSupabase.from('team_members').insert({
          user_id: existingUser.id,
          team_id: invitation.team_id,
          role: invitation.role,
        });
      }

      await adminSupabase
        .from('invitations')
        .update({ status: 'accepted' })
        .eq('id', invitation.id);
    }
    return;
  }

  // New user — check for pending invitation
  // Try by supabase_user_id first, then by inviteId + email match
  if (!invitation && inviteId && supabaseUser.email) {
    const parsedInviteId = parseInt(inviteId, 10);
    if (!isNaN(parsedInviteId) && parsedInviteId > 0) {
      const { data: inviteById } = await adminSupabase
        .from('invitations')
        .select('*')
        .eq('id', parsedInviteId)
        .eq('email', supabaseUser.email.toLowerCase())
        .eq('status', 'pending')
        .limit(1)
        .single();

      if (inviteById) {
        invitation = inviteById;
      }
    }
  }

  if (invitation) {
    // Verify email matches the invitation
    if (invitation.email.toLowerCase() !== supabaseUser.email?.toLowerCase()) {
      console.error('Invitation email mismatch:', {
        invited: invitation.email,
        authenticated: supabaseUser.email
      });
      return;
    }

    // Create app user linked to Supabase Auth
    const { data: newUser, error: userError } = await adminSupabase
      .from('users')
      .insert({
        email: supabaseUser.email!,
        supabase_auth_id: supabaseUser.id,
        password_hash: null,
        role: invitation.role,
      })
      .select()
      .single();

    if (userError || !newUser) {
      if (userError?.code === '23505') return; // Already created by concurrent request
      console.error('Failed to create app user for invited user:', userError);
      return;
    }

    // Create team membership
    const { error: teamMemberError } = await adminSupabase
      .from('team_members')
      .insert({
        user_id: newUser.id,
        team_id: invitation.team_id,
        role: invitation.role,
      });

    if (teamMemberError) {
      console.error('Failed to create team membership for invited user:', teamMemberError);
      return;
    }

    // Mark invitation as accepted
    await adminSupabase
      .from('invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id);

    // Log activity
    await adminSupabase
      .from('activity_logs')
      .insert({
        team_id: invitation.team_id,
        user_id: newUser.id,
        action: 'ACCEPT_INVITATION',
      });

    return;
  }

  // No invitation — provision brand-new user with their own team
  const email = supabaseUser.email;
  if (!email) {
    console.error('Cannot provision user without email');
    return;
  }

  // Create app user
  const { data: newUser, error: userError } = await adminSupabase
    .from('users')
    .insert({
      email,
      supabase_auth_id: supabaseUser.id,
      password_hash: null,
      role: 'owner',
    })
    .select()
    .single();

  if (userError || !newUser) {
    if (userError?.code === '23505') return; // Already created by concurrent request
    console.error('Failed to create app user for new OAuth user:', userError);
    return;
  }

  // Create team
  const { data: newTeam, error: teamError } = await adminSupabase
    .from('teams')
    .insert({
      name: `${email}'s Team`,
    })
    .select()
    .single();

  if (teamError || !newTeam) {
    console.error('Failed to create team for new OAuth user:', teamError);
    return;
  }

  // Create team membership
  const { error: teamMemberError } = await adminSupabase
    .from('team_members')
    .insert({
      user_id: newUser.id,
      team_id: newTeam.id,
      role: 'owner',
    });

  if (teamMemberError) {
    console.error('Failed to create team membership for new OAuth user:', teamMemberError);
    return;
  }

  // Log activities
  await adminSupabase
    .from('activity_logs')
    .insert([
      {
        team_id: newTeam.id,
        user_id: newUser.id,
        action: 'SIGN_UP',
      },
      {
        team_id: newTeam.id,
        user_id: newUser.id,
        action: 'CREATE_TEAM',
      },
    ]);
}

function redirectToNext(request: Request, origin: string, next: string) {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocalEnv = process.env.NODE_ENV === 'development';

  if (isLocalEnv) {
    return NextResponse.redirect(`${origin}${next}`);
  } else if (forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${next}`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
