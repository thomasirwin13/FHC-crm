import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  // Find the team for the current user
  const { data: user } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', 'thomas@elevateequity.com')
    .single();

  if (!user) {
    console.error('User not found');
    process.exit(1);
  }

  const { data: membership } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!membership) {
    console.error('No team found for user');
    process.exit(1);
  }

  const teamId = membership.team_id;
  const apiKey = `zap_${randomBytes(32).toString('hex')}`;

  // Check if one already exists
  const { data: existing } = await supabase
    .from('team_integrations')
    .select('id')
    .eq('team_id', teamId)
    .eq('provider', 'zapier')
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('team_integrations')
      .update({ api_key: apiKey })
      .eq('id', existing.id);

    if (error) {
      console.error('Failed to update key:', error.message);
      process.exit(1);
    }
    console.log('Updated existing Zapier integration key.');
  } else {
    const { error } = await supabase
      .from('team_integrations')
      .insert({ team_id: teamId, provider: 'zapier', api_key: apiKey, config: {} });

    if (error) {
      console.error('Failed to insert key:', error.message);
      process.exit(1);
    }
    console.log('Created Zapier integration.');
  }

  console.log(`\nTeam ID: ${teamId}`);
  console.log(`API Key: ${apiKey}`);
  console.log(`\nUse in Zapier with header:`);
  console.log(`  Authorization: Bearer ${apiKey}`);
}

main();
