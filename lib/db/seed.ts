import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables FIRST
config({ path: '.env.local' });
config({ path: '.env' });

// Create admin client for seeding (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function seed() {
  const email = 'test@test.com';
  const password = 'admin123';

  console.log(`Creating test user: ${email}`);

  // Check if user already exists in Supabase Auth
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingAuthUser = existingUsers?.users?.find(u => u.email === email);

  let supabaseAuthId: string;

  if (existingAuthUser) {
    console.log('Supabase Auth user already exists, using existing...');
    supabaseAuthId = existingAuthUser.id;
  } else {
    // Create user in Supabase Auth (this allows login via supabase.auth.signInWithPassword)
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for test user
    });

    if (authError || !authUser.user) {
      throw new Error(`Failed to create Supabase Auth user: ${authError?.message}`);
    }

    supabaseAuthId = authUser.user.id;
    console.log('Supabase Auth user created.');
  }

  // Check if app user already exists
  const { data: existingAppUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  let userId: number;

  if (existingAppUser) {
    console.log('App user already exists, updating supabase_auth_id...');
    userId = existingAppUser.id;

    // Update to link with Supabase Auth
    await supabase
      .from('users')
      .update({ supabase_auth_id: supabaseAuthId })
      .eq('id', userId);
  } else {
    // Create app user linked to Supabase Auth
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        email,
        supabase_auth_id: supabaseAuthId,
        role: 'owner',
      })
      .select()
      .single();

    if (userError || !user) {
      throw new Error(`Failed to create app user: ${userError?.message}`);
    }

    userId = user.id;
    console.log('App user created.');
  }

  // Check if team already exists for this user
  const { data: existingMembership } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .single();

  if (existingMembership) {
    console.log('Team already exists for user, skipping team creation...');
  } else {
    // Create team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: 'Test Team',
      })
      .select()
      .single();

    if (teamError || !team) {
      throw new Error(`Failed to create team: ${teamError?.message}`);
    }

    // Create team membership
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: userId,
        role: 'owner',
      });

    if (memberError) {
      throw new Error(`Failed to create team member: ${memberError.message}`);
    }

    console.log('Team and membership created.');
  }

  console.log('\n✅ Seed completed successfully!');
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
}

seed()
  .catch((error) => {
    console.error('Seed process failed:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('\nSeed process finished. Exiting...');
    process.exit(0);
  });
