'use client';

import { useState, useMemo, useTransition } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Mail, Loader2, ArrowUpFromLine, Check, Search, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  findUnsyncedNewsletterContactsAction,
  pushContactsToNewsletterAction,
  type UnsyncedContact,
} from './newsletter-actions';

interface Props {
  configured: boolean;
}

type Phase = 'idle' | 'loaded';

export default function NewsletterSyncSection({ configured }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [phase, setPhase] = useState<Phase>('idle');
  const [contacts, setContacts] = useState<UnsyncedContact[]>([]);
  const [pushedIds, setPushedIds] = useState<Set<number>>(new Set());
  const [pushingId, setPushingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [subscriberCount, setSubscriberCount] = useState(0);

  const runFind = () => {
    startTransition(async () => {
      const res = await findUnsyncedNewsletterContactsAction();
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      setContacts(res.result.contacts);
      setSubscriberCount(res.result.subscriberCount);
      setPushedIds(new Set());
      setPhase('loaded');
    });
  };

  const pushOne = (contactId: number) => {
    setPushingId(contactId);
    startTransition(async () => {
      const res = await pushContactsToNewsletterAction([contactId]);
      setPushingId(null);
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      if (res.result.pushed > 0) {
        setPushedIds((prev) => new Set(prev).add(contactId));
        toast.success('Pushed to MailerLite and tagged as Newsletter subscriber');
      } else {
        toast.error('Failed to push contact to MailerLite');
      }
    });
  };

  const pushAll = () => {
    const ids = remaining.map((c) => c.id);
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await pushContactsToNewsletterAction(ids);
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      const succeeded = new Set(ids.filter((id) => !res.result.failedIds.includes(id)));
      setPushedIds((prev) => {
        const next = new Set(prev);
        for (const id of succeeded) next.add(id);
        return next;
      });
      toast.success(
        `Pushed ${res.result.pushed} contact${res.result.pushed !== 1 ? 's' : ''} to MailerLite` +
          (res.result.failed > 0 ? `, ${res.result.failed} failed` : '')
      );
    });
  };

  const remaining = useMemo(
    () => contacts.filter((c) => !pushedIds.has(c.id)),
    [contacts, pushedIds]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return contacts;
    return contacts.filter(
      (c) => c.email.toLowerCase().includes(q) || (c.name && c.name.toLowerCase().includes(q))
    );
  }, [contacts, search]);

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Mail className="h-5 w-5" /> Newsletter sync
        </h2>
        {expanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
      </button>

      {expanded && (
        <Card className="border-border/50 p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Find CRM contacts that have an email address but aren&rsquo;t yet on your
            MailerLite mailing list. Push them one by one (or all at once) — each
            pushed contact is automatically tagged &ldquo;Newsletter subscriber&rdquo;.
          </p>

          {!configured ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
              MailerLite isn&rsquo;t connected yet. Add your API key in{' '}
              <a href="/settings/integrations" className="underline font-medium">
                Settings &rarr; Integrations
              </a>.
            </div>
          ) : phase === 'idle' ? (
            <Button onClick={runFind} disabled={pending}>
              {pending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking…</>
              ) : (
                <><Search className="h-4 w-4 mr-2" /> Find contacts not on the mailing list</>
              )}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm">
                  <span className="font-medium">{remaining.length}</span>{' '}
                  contact{remaining.length !== 1 ? 's' : ''} not on the mailing list
                  <span className="text-muted-foreground"> · {subscriberCount} on MailerLite</span>
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={runFind} disabled={pending}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
                  </Button>
                  {remaining.length > 0 && (
                    <Button size="sm" onClick={pushAll} disabled={pending}>
                      {pending && pushingId === null ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Pushing…</>
                      ) : (
                        <><ArrowUpFromLine className="h-3.5 w-3.5 mr-1.5" /> Push all ({remaining.length})</>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">
                  Every CRM contact with an email is already on the mailing list. 🎉
                </p>
              ) : (
                <>
                  <div className="relative max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search..."
                      className="h-8 text-xs pl-8"
                    />
                  </div>

                  <div className="max-h-96 overflow-y-auto rounded-md border border-border/50 bg-muted/20 divide-y divide-border/30">
                    {filtered.map((c) => {
                      const isPushed = pushedIds.has(c.id);
                      return (
                        <div key={c.id} className="flex items-center gap-2 px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate">{c.name || c.email}</div>
                            {c.name && (
                              <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                            )}
                          </div>
                          {isPushed ? (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-emerald-500/30 text-emerald-500 shrink-0">
                              <Check className="h-3 w-3 mr-1" /> Pushed
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs shrink-0"
                              onClick={() => pushOne(c.id)}
                              disabled={pending}
                            >
                              {pushingId === c.id ? (
                                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Pushing…</>
                              ) : (
                                <><ArrowUpFromLine className="h-3 w-3 mr-1" /> Push</>
                              )}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                    {filtered.length === 0 && (
                      <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                        No contacts match your search.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
