'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Download, KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createApiKeyAction, revokeApiKeyAction } from './api-key-actions';

export interface ApiKeyRow {
  id: number;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface Props {
  keys: ApiKeyRow[];
  mcpBaseUrl: string;
  teamName: string;
}

function formatDate(value: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function connectionFile(name: string, key: string, mcpBaseUrl: string, teamName: string) {
  return [
    `FHC CRM connection for Claude — ${teamName}`,
    `Key name: ${name}`,
    `Created: ${new Date().toLocaleString()}`,
    '',
    'Keep this file private. Anyone with it can read your team\'s CRM data.',
    'If it is lost or shared by mistake, revoke the key in Settings → Integrations.',
    '',
    'Connector URL (paste into Claude → Settings → Connectors → Add custom connector):',
    `${mcpBaseUrl}/${key}`,
    '',
    'Or, for tools that support an Authorization header:',
    `URL:    ${mcpBaseUrl}`,
    `Header: Authorization: Bearer ${key}`,
    '',
    `API key: ${key}`,
    '',
  ].join('\n');
}

export default function ApiKeysCard({ keys, mcpBaseUrl, teamName }: Props) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('Claude cowork');
  const [created, setCreated] = useState<{ name: string; key: string } | null>(null);

  const create = () => {
    startTransition(async () => {
      const res = await createApiKeyAction(name);
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      setCreated({ name: name.trim(), key: res.key });
      setName('Claude cowork');
    });
  };

  const revoke = (key: ApiKeyRow) => {
    if (!confirm(`Revoke "${key.name}"? Anything using it will lose access right away.`)) return;
    startTransition(async () => {
      const res = await revokeApiKeyAction(key.id);
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      toast.success('Key revoked');
    });
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Could not copy — select the text and copy it manually');
    }
  };

  const download = () => {
    if (!created) return;
    const blob = new Blob([connectionFile(created.name, created.key, mcpBaseUrl, teamName)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fhc-crm-claude-connection.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const connectorUrl = created ? `${mcpBaseUrl}/${created.key}` : '';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> Claude access keys
        </CardTitle>
        <CardDescription className="mt-1">
          Let Claude cowork read your team&rsquo;s organizations, contacts and meeting notes. Keys are
          read only: Claude can look things up but can&rsquo;t change anything.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {created ? (
          <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-4">
            <p className="text-sm font-medium">
              Save this now — you won&rsquo;t be able to see the key again.
            </p>
            <div className="space-y-2">
              <Label htmlFor="connector-url">Connector URL</Label>
              <div className="flex gap-2">
                <Input id="connector-url" readOnly value={connectorUrl} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copy(connectorUrl)} aria-label="Copy connector URL">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Download the connection file and keep it somewhere private on your computer.</li>
              <li>In Claude, open Settings → Connectors → Add custom connector.</li>
              <li>Give it a name (e.g. &ldquo;FHC CRM&rdquo;) and paste the connector URL.</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button onClick={download}>
                <Download className="h-4 w-4 mr-2" /> Download connection file
              </Button>
              <Button variant="outline" onClick={() => setCreated(null)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="api-key-name">New key name</Label>
            <div className="flex gap-2">
              <Input
                id="api-key-name"
                placeholder="e.g. Claude cowork on my laptop"
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
              />
              <Button onClick={create} disabled={pending || !name.trim()}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create key'}
              </Button>
            </div>
          </div>
        )}

        {keys.length > 0 && (
          <ul className="divide-y divide-border rounded-md border">
            {keys.map((key) => (
              <li key={key.id} className="flex items-center justify-between gap-4 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{key.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{key.keyPrefix}…</span> · created {formatDate(key.createdAt)} · last
                    used {formatDate(key.lastUsedAt)}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => revoke(key)} disabled={pending}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
