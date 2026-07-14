'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, CircleSlash, Plug } from 'lucide-react';
import { toast } from 'sonner';
import { saveIntegrationAction, disconnectIntegrationAction } from './actions';
import type { IntegrationProvider } from '@/lib/integrations';

export interface ProviderStatus {
  connected: boolean;
  source: 'team' | 'env' | null;
  maskedKey: string | null;
  groupId: string | null;
}

interface Props {
  actionNetwork: ProviderStatus;
  mailerlite: ProviderStatus;
}

export default function IntegrationsForm({ actionNetwork, mailerlite }: Props) {
  return (
    <div className="space-y-6">
      <IntegrationCard
        provider="action_network"
        name="Action Network"
        description="Two-way sync of activists, petition signers, and event attendees. Find your key under Start Organizing → Details → API & Sync."
        keyLabel="API key (OSDI token)"
        keyPlaceholder="Your Action Network API key"
        status={actionNetwork}
      />
      <IntegrationCard
        provider="mailerlite"
        name="MailerLite"
        description="Sync newsletter subscribers. Optionally scope to a single group by ID."
        keyLabel="API key"
        keyPlaceholder="Your MailerLite API key"
        status={mailerlite}
        hasGroupId
      />
    </div>
  );
}

function IntegrationCard({
  provider,
  name,
  description,
  keyLabel,
  keyPlaceholder,
  status,
  hasGroupId,
}: {
  provider: IntegrationProvider;
  name: string;
  description: string;
  keyLabel: string;
  keyPlaceholder: string;
  status: ProviderStatus;
  hasGroupId?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [apiKey, setApiKey] = useState('');
  const [groupId, setGroupId] = useState(status.groupId ?? '');

  const teamConnected = status.source === 'team';

  const save = () => {
    startTransition(async () => {
      const res = await saveIntegrationAction({
        provider,
        apiKey,
        groupId: hasGroupId ? groupId : undefined,
      });
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      setApiKey('');
      toast.success(`${name} saved`);
    });
  };

  const disconnect = () => {
    if (!confirm(`Disconnect ${name} for this team?`)) return;
    startTransition(async () => {
      const res = await disconnectIntegrationAction(provider);
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      setApiKey('');
      toast.success(`${name} disconnected`);
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-4 w-4" /> {name}
            </CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          <StatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${provider}-key`}>{keyLabel}</Label>
          <Input
            id={`${provider}-key`}
            type="password"
            autoComplete="off"
            placeholder={teamConnected ? `${status.maskedKey} — enter a new key to replace` : keyPlaceholder}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          {status.source === 'env' && (
            <p className="text-xs text-muted-foreground">
              Currently using a shared key from the environment. Enter your team&rsquo;s own key to override it.
            </p>
          )}
        </div>

        {hasGroupId && (
          <div className="space-y-2">
            <Label htmlFor={`${provider}-group`}>Group ID (optional)</Label>
            <Input
              id={`${provider}-group`}
              placeholder="Leave blank to sync your whole list"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
            />
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={save} disabled={pending}>
            {pending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
            ) : (
              teamConnected ? 'Update' : 'Connect'
            )}
          </Button>
          {teamConnected && (
            <Button variant="outline" onClick={disconnect} disabled={pending}>
              Disconnect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: ProviderStatus }) {
  if (!status.connected) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
        <CircleSlash className="h-3.5 w-3.5" /> Not connected
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 shrink-0">
      <CheckCircle2 className="h-3.5 w-3.5" />
      {status.source === 'env' ? 'Shared key' : 'Connected'}
    </span>
  );
}
