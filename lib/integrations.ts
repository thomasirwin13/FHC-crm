// Per-team integration credentials, stored in the team_integrations table
// (protected by RLS). Resolvers fall back to the global env var when a team
// hasn't set its own key, so an existing single-tenant deployment keeps working
// while other teams override with their own credentials.

import { createClient } from '@/lib/supabase/server';

export type IntegrationProvider = 'action_network' | 'mailerlite' | 'monday' | 'settings';

export interface TeamIntegration {
  apiKey: string | null;
  config: Record<string, any>;
}

export async function getTeamIntegration(
  teamId: number,
  provider: IntegrationProvider,
): Promise<TeamIntegration | null> {
  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from('team_integrations')
    .select('api_key, config')
    .eq('team_id', teamId)
    .eq('provider', provider)
    .maybeSingle();
  if (!data) return null;
  return { apiKey: data.api_key ?? null, config: data.config ?? {} };
}

function clean(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

/** Resolve the Action Network key for a team (team credential, else env). */
export async function resolveActionNetworkKey(teamId: number): Promise<string | null> {
  const row = await getTeamIntegration(teamId, 'action_network');
  return clean(row?.apiKey) || clean(process.env.ACTION_NETWORK_API_KEY);
}

/** Resolve Monday.com token + board ID for a team (team credential, else env). */
export async function resolveMonday(
  teamId: number,
): Promise<{ apiToken: string | null; boardId: string | null }> {
  const row = await getTeamIntegration(teamId, 'monday');
  return {
    apiToken: clean(row?.apiKey) || clean(process.env.MONDAY_API_TOKEN),
    boardId: clean(row?.config?.board_id) || clean(process.env.MONDAY_BOARD_ID),
  };
}

export const DEFAULT_REGIONS = [
  'Antelope Valley',
  'San Fernando Valley',
  'San Gabriel Valley',
  'Metro/Central LA',
  'West LA',
  'South LA',
  'South East LA',
  'South Bay',
  'Orange County',
  'Other',
];

/** Resolve the custom regions for a team, falling back to defaults. */
export async function resolveRegions(teamId: number): Promise<string[]> {
  const row = await getTeamIntegration(teamId, 'settings');
  const regions = row?.config?.regions;
  if (Array.isArray(regions) && regions.length > 0) return regions;
  return DEFAULT_REGIONS;
}

/** Resolve MailerLite key + group id for a team (team credential, else env). */
export async function resolveMailerLite(
  teamId: number,
): Promise<{ apiKey: string | null; groupId: string | null }> {
  const row = await getTeamIntegration(teamId, 'mailerlite');
  return {
    apiKey: clean(row?.apiKey) || clean(process.env.MAILERLITE_API_KEY),
    groupId: clean(row?.config?.group_id) || clean(process.env.MAILERLITE_GROUP_ID),
  };
}
