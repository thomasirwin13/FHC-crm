'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Copy,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  Download,
  ArrowRight,
  ArrowLeft,
  MessageSquare,
  Mail,
  Users,
  Phone,
} from 'lucide-react';
import { toast } from 'sonner';
import { generateContactMessagesAction, type GeneratedMessage } from './message-actions';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const ENGAGEMENT_LEVELS = [
  { value: 'activist', label: 'Activist (4)' },
  { value: 'attender', label: 'Attender (3)' },
  { value: 'participator', label: 'Participator (2)' },
  { value: 'learner', label: 'Learner (1)' },
  { value: 'potential', label: 'Potential (0)' },
];

const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: '__none__', label: 'Not set' },
];

const LAST_1ON1_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: 'never', label: 'Never had a 1-on-1' },
  { value: '7', label: 'Over 7 days ago' },
  { value: '14', label: 'Over 14 days ago' },
  { value: '30', label: 'Over 30 days ago' },
  { value: '60', label: 'Over 60 days ago' },
  { value: '90', label: 'Over 90 days ago' },
];

interface DraftMessagesDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contacts: any[];
  lastOneOnOneMap: Record<number, string>;
}

export default function DraftMessagesDialog({
  open,
  onOpenChange,
  contacts,
  lastOneOnOneMap,
}: DraftMessagesDialogProps) {
  const [step, setStep] = useState<'filter' | 'prompt' | 'results'>('filter');

  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set());
  const [selectedFrequencies, setSelectedFrequencies] = useState<Set<string>>(new Set());
  const [lastOneOnOneFilter, setLastOneOnOneFilter] = useState('any');
  const [committedFilter, setCommittedFilter] = useState('any');

  const [prompt, setPrompt] = useState('');
  const [channel, setChannel] = useState<'text' | 'email' | 'whatsapp'>('text');

  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<GeneratedMessage[] | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const filteredContacts = useMemo(() => {
    let list = contacts;

    if (selectedLevels.size > 0) {
      list = list.filter((c: any) => selectedLevels.has(c.engagement_level || 'potential'));
    }

    if (selectedFrequencies.size > 0) {
      list = list.filter((c: any) => {
        const freq = c.outreach_frequency || '__none__';
        return selectedFrequencies.has(freq);
      });
    }

    if (committedFilter === 'yes') {
      list = list.filter((c: any) => c.action_committed === true);
    } else if (committedFilter === 'no') {
      list = list.filter((c: any) => c.action_committed !== true);
    }

    if (lastOneOnOneFilter !== 'any') {
      const now = new Date();
      if (lastOneOnOneFilter === 'never') {
        list = list.filter((c: any) => !lastOneOnOneMap[c.id]);
      } else {
        const days = parseInt(lastOneOnOneFilter);
        const threshold = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        list = list.filter((c: any) => {
          const lastDate = lastOneOnOneMap[c.id];
          if (!lastDate) return true;
          return new Date(lastDate) < threshold;
        });
      }
    }

    return list;
  }, [contacts, selectedLevels, selectedFrequencies, lastOneOnOneFilter, committedFilter, lastOneOnOneMap]);

  const toggleLevel = (level: string) => {
    setSelectedLevels((prev) => {
      const next = new Set(prev);
      next.has(level) ? next.delete(level) : next.add(level);
      return next;
    });
  };

  const toggleFrequency = (freq: string) => {
    setSelectedFrequencies((prev) => {
      const next = new Set(prev);
      next.has(freq) ? next.delete(freq) : next.add(freq);
      return next;
    });
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please describe what the message should accomplish');
      return;
    }
    if (filteredContacts.length === 0) {
      toast.error('No contacts match your criteria');
      return;
    }
    if (filteredContacts.length > 50) {
      toast.error('Maximum 50 contacts per batch. Narrow your filters.');
      return;
    }

    setLoading(true);
    const ids = filteredContacts.map((c: any) => c.id);
    try {
      const result = await generateContactMessagesAction(ids, prompt, channel);

      if ('error' in result && result.error) {
        toast.error(result.error);
        return;
      }
      if ('messages' in result && result.messages) {
        setMessages(result.messages);
        setExpandedId(result.messages[0]?.contactId ?? null);
        setStep('results');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate messages. Check that your OpenAI API key is configured.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (msg: GeneratedMessage) => {
    const text = channel === 'email'
      ? `Subject: ${msg.subject}\n\n${msg.body}`
      : msg.body;
    await navigator.clipboard.writeText(text);
    setCopiedId(msg.contactId);
    toast.success(`Copied message for ${msg.contactName}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = async () => {
    if (!messages) return;
    const allText = messages.map((msg) => {
      const header = `--- ${msg.contactName}${msg.contactPhone ? ` (${msg.contactPhone})` : msg.contactEmail ? ` (${msg.contactEmail})` : ''} ---`;
      return channel === 'email'
        ? `${header}\nSubject: ${msg.subject}\n\n${msg.body}`
        : `${header}\n${msg.body}`;
    }).join('\n\n');
    await navigator.clipboard.writeText(allText);
    toast.success(`Copied all ${messages.length} messages`);
  };

  const handleExportCsv = () => {
    if (!messages) return;
    const escape = (v: string) => {
      if (v.includes(',') || v.includes('"') || v.includes('\n')) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    };
    const isText = channel === 'text' || channel === 'whatsapp';
    const headers = isText
      ? ['Name', 'Phone', 'Message']
      : ['Name', 'Email', 'Subject', 'Body'];
    const rows = messages.map((m) =>
      isText
        ? [escape(m.contactName), escape(m.contactPhone || ''), escape(m.body)].join(',')
        : [escape(m.contactName), escape(m.contactEmail || ''), escape(m.subject), escape(m.body)].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `draft-messages-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setStep('filter');
      setMessages(null);
      setPrompt('');
      setExpandedId(null);
    }
    onOpenChange(v);
  };

  const hasActiveFilters = selectedLevels.size > 0 || selectedFrequencies.size > 0 || lastOneOnOneFilter !== 'any' || committedFilter !== 'any';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 'filter' && 'Draft messages'}
            {step === 'prompt' && `Compose for ${filteredContacts.length} contact${filteredContacts.length !== 1 ? 's' : ''}`}
            {step === 'results' && `${messages?.length ?? 0} messages generated`}
          </DialogTitle>
          <DialogDescription>
            {step === 'filter' && 'Filter contacts by criteria, then generate personalized messages with AI.'}
            {step === 'prompt' && 'Describe your goal and the AI will create a personalized message for each contact.'}
            {step === 'results' && 'Review, copy, or export the generated messages below.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'filter' && (
          <div className="space-y-4 overflow-y-auto">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Engagement level</label>
              <div className="flex flex-wrap gap-1.5">
                {ENGAGEMENT_LEVELS.map((lvl) => (
                  <button
                    key={lvl.value}
                    type="button"
                    onClick={() => toggleLevel(lvl.value)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                      selectedLevels.has(lvl.value)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30'
                    )}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
              {selectedLevels.size === 0 && (
                <p className="text-xs text-muted-foreground mt-1">All levels included</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Outreach frequency</label>
              <div className="flex flex-wrap gap-1.5">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => toggleFrequency(f.value)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                      selectedFrequencies.has(f.value)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {selectedFrequencies.size === 0 && (
                <p className="text-xs text-muted-foreground mt-1">All frequencies included</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Last 1-on-1</label>
                <Select value={lastOneOnOneFilter} onValueChange={setLastOneOnOneFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LAST_1ON1_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Committed to action</label>
                <Select value={committedFilter} onValueChange={setCommittedFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border border-border/50 rounded-lg">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
                <span className="text-sm font-medium flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''} match
                  {!hasActiveFilters && <span className="text-muted-foreground font-normal">(no filters applied)</span>}
                </span>
                {filteredContacts.length > 50 && (
                  <span className="text-xs text-destructive">Max 50 per batch</span>
                )}
              </div>
              <div className="max-h-36 overflow-y-auto divide-y divide-border/20">
                {filteredContacts.slice(0, 100).map((c: any) => {
                  const lastDate = lastOneOnOneMap[c.id];
                  return (
                    <div key={c.id} className="px-3 py-1.5 flex items-center justify-between text-xs">
                      <div className="min-w-0">
                        <span className="font-medium">{c.name}</span>
                        {c.organization?.name && (
                          <span className="text-muted-foreground ml-1.5">({c.organization.name})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 text-muted-foreground ml-2">
                        {c.phone && (
                          <span className="flex items-center gap-0.5">
                            <Phone className="h-2.5 w-2.5" />
                            {c.phone}
                          </span>
                        )}
                        {lastDate && (
                          <span>1-on-1: {format(new Date(lastDate), 'MMM d')}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filteredContacts.length === 0 && (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    No contacts match your criteria
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={() => setStep('prompt')}
              disabled={filteredContacts.length === 0 || filteredContacts.length > 50}
              className="w-full"
            >
              Next: compose message
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {step === 'prompt' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Channel</label>
              <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">
                    <span className="flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5" /> Text message</span>
                  </SelectItem>
                  <SelectItem value="email">
                    <span className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> Email</span>
                  </SelectItem>
                  <SelectItem value="whatsapp">
                    <span className="flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5" /> WhatsApp</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Message goal</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={`e.g. "Check in and invite to our housing workshop next Saturday at 10am at City Hall" or "Follow up after last week's meeting and ask about their availability for a 1-on-1"`}
                rows={4}
                className="resize-none"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Each message will be personalized using the contact&apos;s name, organization, engagement level, and background.
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('filter')} disabled={loading}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleGenerate} disabled={loading || !prompt.trim()} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating {filteredContacts.length} message{filteredContacts.length !== 1 ? 's' : ''}...
                  </>
                ) : (
                  `Generate ${filteredContacts.length} message${filteredContacts.length !== 1 ? 's' : ''}`
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'results' && messages && (
          <div className="flex flex-col min-h-0 flex-1">
            <div className="flex gap-2 mb-3">
              <Button variant="outline" size="sm" onClick={handleCopyAll}>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy all
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCsv}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
              </Button>
              <div className="flex-1" />
              <Button variant="outline" size="sm" onClick={() => { setMessages(null); setStep('prompt'); }}>
                Regenerate
              </Button>
            </div>

            <div className="overflow-y-auto flex-1 border border-border/50 rounded-lg divide-y divide-border/30">
              {messages.map((msg) => {
                const isExpanded = expandedId === msg.contactId;
                return (
                  <div key={msg.contactId} className="bg-background">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : msg.contactId)}
                    >
                      <div className="min-w-0">
                        <span className="text-sm font-medium">{msg.contactName}</span>
                        {(channel === 'text' || channel === 'whatsapp') && msg.contactPhone && (
                          <span className="text-xs text-muted-foreground ml-2">{msg.contactPhone}</span>
                        )}
                        {channel === 'email' && msg.contactEmail && (
                          <span className="text-xs text-muted-foreground ml-2">{msg.contactEmail}</span>
                        )}
                        {channel === 'email' && !isExpanded && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.subject}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => { e.stopPropagation(); handleCopy(msg); }}
                        >
                          {copiedId === msg.contactId ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-2">
                        {channel === 'email' && (
                          <div className="bg-muted/30 rounded px-3 py-2">
                            <span className="text-xs font-medium text-muted-foreground">Subject: </span>
                            <span className="text-sm">{msg.subject}</span>
                          </div>
                        )}
                        <div className="bg-muted/30 rounded px-3 py-2">
                          <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
