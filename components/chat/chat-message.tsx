'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Database, Search, Package, List, Link2, Pencil, Sparkles, Building2, Trash2, Users, Mail, MessageSquare, Shield } from 'lucide-react';
import { MemoizedMarkdown } from './memoized-markdown';
import { cn } from '@/lib/utils';
import {
  ConfirmationDisplay,
  type ConfirmationType,
  type ConfirmationStatus,
} from './confirmation-display';

interface ChatMessageProps {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content?: string;
  parts?: any[];
  timestamp?: string;
  confirmationStates?: Record<string, { status: ConfirmationStatus; error?: string }>;
  onConfirm?: (id: string, type: ConfirmationType, data: Record<string, any>) => Promise<void>;
  onCancel?: (id: string) => void;
}

function ToolDisplay({ part, partIndex }: { part: any; partIndex: number }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Determine tool type and display info
  const getToolInfo = () => {
    switch (part.type) {
      case 'tool-getInformation':
        return {
          icon: part.state === 'output-available' ? Search : Loader2,
          label: part.state === 'output-available' ? 'Searched library' : 'Searching...',
        };
      case 'tool-listCollections':
        return {
          icon: part.state === 'output-available' ? Package : Loader2,
          label: part.state === 'output-available' ? 'Listed collections' : 'Loading collections...',
        };
      case 'tool-browseBlocks':
        return {
          icon: part.state === 'output-available' ? List : Loader2,
          label: part.state === 'output-available' ? 'Browsed blocks' : 'Loading blocks...',
        };
      case 'tool-getAppLinks':
        return {
          icon: part.state === 'output-available' ? Link2 : Loader2,
          label: part.state === 'output-available' ? 'Got navigation links' : 'Getting links...',
        };
      case 'tool-editCollection':
        return {
          icon: part.state === 'output-available' ? Pencil : Loader2,
          label: part.state === 'output-available' ? 'Edit collection' : 'Loading collection...',
        };
      case 'tool-addCollectionResource':
        return {
          icon: part.state === 'output-available' ? Link2 : Loader2,
          label: part.state === 'output-available' ? 'Add resource' : 'Loading collection...',
        };
      case 'tool-addBlock':
        return {
          icon: part.state === 'output-available' ? Sparkles : Loader2,
          label: part.state === 'output-available' ? 'Add block' : 'Loading collection...',
        };
      case 'tool-editBlock':
        return {
          icon: part.state === 'output-available' ? Pencil : Loader2,
          label: part.state === 'output-available' ? 'Edit block' : 'Loading block...',
        };
      case 'tool-listOrganizations':
        return {
          icon: part.state === 'output-available' ? Building2 : Loader2,
          label: part.state === 'output-available' ? 'Listed organizations' : 'Loading organizations...',
        };
      case 'tool-addOrganization':
        return {
          icon: part.state === 'output-available' ? Building2 : Loader2,
          label: part.state === 'output-available' ? 'Add organization' : 'Preparing...',
        };
      case 'tool-editOrganization':
        return {
          icon: part.state === 'output-available' ? Pencil : Loader2,
          label: part.state === 'output-available' ? 'Edit organization' : 'Loading organization...',
        };
      case 'tool-deleteOrganization':
        return {
          icon: part.state === 'output-available' ? Trash2 : Loader2,
          label: part.state === 'output-available' ? 'Delete organization' : 'Loading organization...',
        };
      default:
        return {
          icon: Database,
          label: part.type.replace('tool-', ''),
        };
    }
  };

  const toolInfo = getToolInfo();
  const Icon = toolInfo.icon;
  const isLoading = part.state !== 'output-available';

  // Extract result count based on tool type
  const getResultCount = () => {
    if (!part.output) return null;
    if (part.output.contentBlocks?.length) return part.output.contentBlocks.length;
    if (part.output.collections?.length) return part.output.collections.length;
    if (part.output.count) return part.output.count;
    if (part.output.totalCount) return part.output.totalCount;
    return null;
  };

  const resultCount = getResultCount();

  return (
    <div
      key={partIndex}
      className="my-2 rounded-md bg-muted/20 overflow-hidden"
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
      >
        <Icon
          className={cn(
            "w-3.5 h-3.5",
            isLoading && "animate-spin"
          )}
          strokeWidth={2}
        />
        <span className="flex-1 text-left">
          {toolInfo.label}
          {resultCount !== null && (
            <span className="ml-1 opacity-70">
              · {resultCount} result{resultCount !== 1 ? 's' : ''}
            </span>
          )}
        </span>
        {!isLoading && (
          isExpanded ? (
            <ChevronDown className="w-3 h-3 opacity-50" />
          ) : (
            <ChevronRight className="w-3 h-3 opacity-50" />
          )
        )}
      </button>

      {isExpanded && part.state === 'output-available' && (
        <div className="px-3 pb-2 pt-1 border-t border-border/20 space-y-2">
          {part.input && Object.keys(part.input).length > 0 && (
            <div className="text-[11px]">
              <span className="text-muted-foreground/60">Input: </span>
              <code className="text-muted-foreground">{JSON.stringify(part.input)}</code>
            </div>
          )}
          {part.output && (
            <details className="text-[11px] text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground/70 transition-colors">
                View output
              </summary>
              <pre className="mt-1.5 p-2 bg-background/50 rounded text-[10px] overflow-x-auto max-h-48">
                {JSON.stringify(part.output, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function AudiencePreviewCard({ data }: { data: any }) {
  return (
    <div className="my-2 rounded-lg border border-border/60 bg-card overflow-hidden">
      <div className="px-4 py-3 bg-muted/30 border-b border-border/40 flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Audience preview</span>
        {data.filterSummary && (
          <span className="text-xs text-muted-foreground ml-auto truncate max-w-[300px]">{data.filterSummary}</span>
        )}
      </div>
      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="text-center">
          <div className="text-2xl font-semibold">{data.totalMatching?.toLocaleString() ?? 0}</div>
          <div className="text-xs text-muted-foreground">Total matching</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-semibold text-green-600 dark:text-green-400">{data.contactableEmail?.toLocaleString() ?? 0}</div>
          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Mail className="h-3 w-3" /> Email</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-semibold text-blue-600 dark:text-blue-400">{data.contactableSms?.toLocaleString() ?? 0}</div>
          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1"><MessageSquare className="h-3 w-3" /> SMS</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-semibold text-orange-600 dark:text-orange-400">{data.excluded?.toLocaleString() ?? 0}</div>
          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Shield className="h-3 w-3" /> Excluded</div>
        </div>
      </div>
      {data.sample && data.sample.length > 0 && (
        <div className="px-4 pb-3">
          <div className="text-xs text-muted-foreground mb-1.5">Sample contacts:</div>
          <div className="space-y-1">
            {data.sample.map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="font-medium truncate max-w-[150px]">{c.name || c.email || 'Unknown'}</span>
                {c.email && <span className="text-muted-foreground truncate">{c.email}</span>}
                {c.city && <span className="text-muted-foreground">· {c.city}</span>}
                {c.engagement_level && <span className="text-muted-foreground/60">· {c.engagement_level}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {data.suppressionRules && (
        <div className="px-4 pb-3 text-[10px] text-muted-foreground/60">
          Suppression: {data.suppressionRules}
        </div>
      )}
    </div>
  );
}

export function ChatMessage({
  id,
  role,
  content,
  parts,
  confirmationStates = {},
  onConfirm,
  onCancel,
}: ChatMessageProps) {
  const isUser = role === 'user';
  const isAssistant = role === 'assistant';

  // User messages - right aligned bubble
  if (isUser) {
    const textContent = parts?.find(p => p.type === 'text')?.text || content || '';

    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] sm:max-w-[75%]">
          <div className="px-4 py-2.5 rounded-2xl rounded-br-md bg-muted/80 text-foreground">
            <p className="text-[15px] whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{textContent}</p>
          </div>
        </div>
      </div>
    );
  }

  // Assistant messages - left aligned, no bubble
  if (isAssistant) {
    return (
      <div className="max-w-[90%] sm:max-w-[85%]">
        <div className="text-[15px] text-foreground/90">
          {parts && parts.length > 0 ? (
            parts.map((part, partIndex) => {
              switch (part.type) {
                case 'text':
                  return (
                    <div
                      key={partIndex}
                      className="prose prose-base dark:prose-invert prose-p:leading-relaxed prose-p:my-2 prose-headings:font-semibold prose-headings:tracking-tight prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border/50 prose-code:text-foreground prose-code:before:content-none prose-code:after:content-none max-w-none"
                    >
                      <MemoizedMarkdown id={`${id}-${partIndex}`} content={part.text} />
                    </div>
                  );
                case 'tool-getInformation':
                case 'tool-listCollections':
                case 'tool-browseBlocks':
                case 'tool-getAppLinks':
                case 'tool-listOrganizations':
                case 'tool-searchCRM':
                case 'tool-listReportFields':
                case 'tool-runSavedReport':
                  return <ToolDisplay key={partIndex} part={part} partIndex={partIndex} />;
                case 'tool-previewAudience':
                  if (part.state === 'output-available' && part.output && !part.output.error) {
                    return (
                      <AudiencePreviewCard key={partIndex} data={part.output} />
                    );
                  }
                  return <ToolDisplay key={partIndex} part={part} partIndex={partIndex} />;
                case 'tool-editCollection':
                case 'tool-addCollectionResource':
                case 'tool-addBlock':
                case 'tool-editBlock':
                case 'tool-addOrganization':
                case 'tool-editOrganization':
                case 'tool-deleteOrganization':
                case 'tool-saveAudienceSegment':
                case 'tool-createCampaignDraft':
                case 'tool-draftAudienceMessage':
                case 'tool-syncAudienceToActionNetwork':
                  // Show confirmation UI for collection/company management tools
                  if (part.state === 'output-available' && part.output?.needsConfirmation && onConfirm && onCancel) {
                    const confirmationId = part.output.confirmationId;
                    const state = confirmationStates[confirmationId] || { status: 'pending' as ConfirmationStatus };
                    return (
                      <ConfirmationDisplay
                        key={partIndex}
                        type={part.output.confirmationType}
                        confirmationId={confirmationId}
                        preview={part.output.preview}
                        currentValues={part.output.currentValues}
                        collectionId={part.output.collectionId}
                        collectionName={part.output.collectionName}
                        blockId={part.output.blockId}
                        organizationId={part.output.organizationId}
                        organizationName={part.output.organizationName}
                        onConfirm={onConfirm}
                        onCancel={onCancel}
                        status={state.status}
                        error={state.error}
                      />
                    );
                  }
                  // Show error message if tool returned an error
                  if (part.state === 'output-available' && part.output?.error) {
                    return (
                      <div key={partIndex} className="my-2 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-sm text-red-400">
                        {part.output.message || 'An error occurred'}
                      </div>
                    );
                  }
                  return <ToolDisplay key={partIndex} part={part} partIndex={partIndex} />;
                default:
                  return null;
              }
            })
          ) : (
            <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
          )}
        </div>
      </div>
    );
  }

  // System messages - centered, subtle
  return (
    <div className="flex justify-center">
      <div className="px-3 py-1.5 rounded-full bg-muted/40 border border-border/30">
        <p className="text-xs text-muted-foreground">{content}</p>
      </div>
    </div>
  );
}
