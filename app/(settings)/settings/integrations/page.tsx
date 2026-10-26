import { getTeamForUser, getUser } from '@/lib/db/supabase-queries';
import { getTeamIntegration } from '@/lib/integrations';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import IntegrationsForm, { type ProviderStatus } from './integrations-form';
import ApiKeysCard, { type ApiKeyRow } from './api-keys-card';

function mask(key: string): string {
  const last4 = key.slice(-4);
  return `••••••••${last4}`;
}

async function getMcpBaseUrl(): Promise<string> {
  const base = process.env.BASE_URL?.trim();
  if (base) return `${base.replace(/\/$/, '')}/api/mcp`;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}/api/mcp`;
}

async function getApiKeys(teamId: number, userId: number): Promise<ApiKeyRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, created_at, last_used_at, can_write, created_by')
    .eq('team_id', teamId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  return (data ?? []).map((k) => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.key_prefix,
    createdAt: k.created_at,
    lastUsedAt: k.last_used_at,
    canWrite: k.can_write,
    isMine: k.created_by === userId,
  }));
}

function buildStatus(
  teamKey: string | null,
  envKey: string | undefined,
  groupId: string | null,
): ProviderStatus {
  const team = teamKey?.trim() || null;
  const env = envKey?.trim() || null;
  return {
    connected: !!(team || env),
    source: team ? 'team' : env ? 'env' : null,
    maskedKey: team ? mask(team) : null,
    groupId: groupId ?? null,
  };
}

export default async function IntegrationsPage() {
  const [team, user] = await Promise.all([getTeamForUser(), getUser()]);

  if (!team || !user) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Integrations</h1>
        <p className="text-muted-foreground">No team found. Please contact support.</p>
      </div>
    );
  }

  const [anRow, mlRow, monRow, apiKeys, mcpBaseUrl] = await Promise.all([
    getTeamIntegration(team.id, 'action_network'),
    getTeamIntegration(team.id, 'mailerlite'),
    getTeamIntegration(team.id, 'monday'),
    getApiKeys(team.id, user.id),
    getMcpBaseUrl(),
  ]);

  const actionNetwork = buildStatus(anRow?.apiKey ?? null, process.env.ACTION_NETWORK_API_KEY, null);
  const mailerlite = buildStatus(
    mlRow?.apiKey ?? null,
    process.env.MAILERLITE_API_KEY,
    (mlRow?.config?.group_id as string | undefined) ?? null
  );
  const monday = buildStatus(
    monRow?.apiKey ?? null,
    process.env.MONDAY_API_TOKEN,
    (monRow?.config?.board_id as string | undefined) ?? null
  );

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground mt-1">
          Connect your team&rsquo;s own accounts. Keys are stored per team, so each
          organization syncs against its own integrations.
        </p>
      </div>
      <div className="space-y-6">
        <ApiKeysCard keys={apiKeys} mcpBaseUrl={mcpBaseUrl} teamName={team.name} />
        <IntegrationsForm actionNetwork={actionNetwork} mailerlite={mailerlite} monday={monday} />
      </div>
    </div>
  );
}
