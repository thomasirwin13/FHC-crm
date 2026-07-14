import { getTeamForUser } from '@/lib/db/supabase-queries';
import { getTeamIntegration } from '@/lib/integrations';
import IntegrationsForm, { type ProviderStatus } from './integrations-form';

function mask(key: string): string {
  const last4 = key.slice(-4);
  return `••••••••${last4}`;
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
  const team = await getTeamForUser();

  if (!team) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Integrations</h1>
        <p className="text-muted-foreground">No team found. Please contact support.</p>
      </div>
    );
  }

  const [anRow, mlRow] = await Promise.all([
    getTeamIntegration(team.id, 'action_network'),
    getTeamIntegration(team.id, 'mailerlite'),
  ]);

  const actionNetwork = buildStatus(anRow?.apiKey ?? null, process.env.ACTION_NETWORK_API_KEY, null);
  const mailerlite = buildStatus(
    mlRow?.apiKey ?? null,
    process.env.MAILERLITE_API_KEY,
    (mlRow?.config?.group_id as string | undefined) ?? null
  );

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground mt-1">
          Connect your team&rsquo;s own accounts. Keys are stored per team, so each
          organization syncs against its own Action Network and MailerLite.
        </p>
      </div>
      <IntegrationsForm actionNetwork={actionNetwork} mailerlite={mailerlite} />
    </div>
  );
}
