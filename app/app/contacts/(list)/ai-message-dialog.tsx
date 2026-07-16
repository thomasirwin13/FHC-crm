'use client';

import { useState } from 'react';
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
import { Copy, Check, Loader2, ChevronDown, ChevronUp, Mail, MessageSquare, Download } from 'lucide-react';
import { toast } from 'sonner';
import { generateContactMessagesAction, type GeneratedMessage } from './message-actions';

interface AIMessageDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedCount: number;
  selectedIds: number[];
}

export default function AIMessageDialog({
  open,
  onOpenChange,
  selectedCount,
  selectedIds,
}: AIMessageDialogProps) {
  const [prompt, setPrompt] = useState('');
  const [channel, setChannel] = useState<'email' | 'text' | 'whatsapp'>('email');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<GeneratedMessage[] | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please describe what the message should accomplish');
      return;
    }
    setLoading(true);
    setMessages(null);
    const result = await generateContactMessagesAction(selectedIds, prompt, channel);
    setLoading(false);

    if ('error' in result && result.error) {
      toast.error(result.error);
      return;
    }
    if ('messages' in result && result.messages) {
      setMessages(result.messages);
      setExpandedId(result.messages[0]?.contactId ?? null);
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
      const header = `--- ${msg.contactName}${msg.contactEmail ? ` (${msg.contactEmail})` : ''} ---`;
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
    const headers = ['Name', 'Email', 'Subject', 'Body'];
    const rows = messages.map((m) =>
      [escape(m.contactName), escape(m.contactEmail || ''), escape(m.subject), escape(m.body)].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-messages-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setMessages(null);
      setPrompt('');
      setExpandedId(null);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {messages ? `${messages.length} messages generated` : `Craft messages for ${selectedCount} contact${selectedCount !== 1 ? 's' : ''}`}
          </DialogTitle>
          <DialogDescription>
            {messages
              ? 'Review, copy, or export the generated messages below.'
              : 'Describe your goal and the AI will create a personalized message for each contact.'}
          </DialogDescription>
        </DialogHeader>

        {!messages ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Channel</label>
              <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <span className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> Email</span>
                  </SelectItem>
                  <SelectItem value="text">
                    <span className="flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5" /> Text message</span>
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
                placeholder={`e.g. "Invite them to our community meeting next Thursday at 6pm at City Hall" or "Follow up after last week's housing workshop and ask about their availability for a 1-on-1"`}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                The AI will personalize each message based on the contact&apos;s name, organization, engagement level, and background.
              </p>
            </div>

            <Button onClick={handleGenerate} disabled={loading || !prompt.trim()} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating {selectedCount} message{selectedCount !== 1 ? 's' : ''}...
                </>
              ) : (
                `Generate ${selectedCount} message${selectedCount !== 1 ? 's' : ''}`
              )}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col min-h-0 flex-1">
            <div className="flex gap-2 mb-3">
              <Button variant="outline" size="sm" onClick={handleCopyAll}>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy all
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCsv}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
              </Button>
              <div className="flex-1" />
              <Button variant="outline" size="sm" onClick={() => setMessages(null)}>
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
                        {msg.contactEmail && (
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
