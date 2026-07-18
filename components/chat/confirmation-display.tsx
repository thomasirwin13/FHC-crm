'use client';

import { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Package,
  Link2,
  Sparkles,
  Pencil,
  Building2,
  AlertTriangle,
  Users,
  Mail,
  Send,
  Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ConfirmationStatus =
  | 'pending'
  | 'loading'
  | 'confirmed'
  | 'cancelled'
  | 'error';

export type ConfirmationType =
  | 'edit_collection'
  | 'add_resource'
  | 'add_block'
  | 'edit_block'
  | 'add_organization'
  | 'edit_organization'
  | 'delete_organization'
  | 'save_audience_segment'
  | 'draft_audience_message'
  | 'create_campaign_draft'
  | 'sync_to_action_network';

export interface ConfirmationDisplayProps {
  type: ConfirmationType;
  confirmationId: string;
  preview: Record<string, any>;
  currentValues?: Record<string, any>;
  collectionId?: number;
  collectionName?: string;
  blockId?: number;
  organizationId?: number;
  organizationName?: string;
  onConfirm: (
    id: string,
    type: ConfirmationType,
    data: Record<string, any>
  ) => Promise<void>;
  onCancel: (id: string) => void;
  status: ConfirmationStatus;
  error?: string;
}

function getIcon(type: ConfirmationType) {
  switch (type) {
    case 'edit_collection':
      return Pencil;
    case 'add_resource':
      return Link2;
    case 'add_block':
      return Sparkles;
    case 'edit_block':
      return Pencil;
    case 'add_organization':
    case 'edit_organization':
    case 'delete_organization':
      return Building2;
    case 'save_audience_segment':
      return Users;
    case 'draft_audience_message':
      return Mail;
    case 'create_campaign_draft':
      return Send;
    case 'sync_to_action_network':
      return Share2;
    default:
      return Package;
  }
}

function getTitle(type: ConfirmationType, collectionName?: string, organizationName?: string) {
  const name = collectionName || 'collection';
  switch (type) {
    case 'edit_collection':
      return `Edit ${name}`;
    case 'add_resource':
      return `Add resource to ${name}`;
    case 'add_block':
      return `Add block to ${name}`;
    case 'edit_block':
      return 'Edit block';
    case 'add_organization':
      return 'Add organization';
    case 'edit_organization':
      return `Edit ${organizationName || 'organization'}`;
    case 'delete_organization':
      return `Delete ${organizationName || 'organization'}`;
    case 'save_audience_segment':
      return 'Save audience segment';
    case 'draft_audience_message':
      return 'Draft audience message';
    case 'create_campaign_draft':
      return 'Create campaign draft';
    case 'sync_to_action_network':
      return 'Sync to Action Network';
    default:
      return 'Confirm action';
  }
}

function getSuccessMessage(type: ConfirmationType, collectionName?: string, organizationName?: string) {
  const name = collectionName || 'collection';
  switch (type) {
    case 'edit_collection':
      return `Updated ${name}`;
    case 'add_resource':
      return `Added resource to ${name}`;
    case 'add_block':
      return `Added block to ${name}`;
    case 'edit_block':
      return 'Updated block';
    case 'add_organization':
      return 'Organization created';
    case 'edit_organization':
      return `Updated ${organizationName || 'organization'}`;
    case 'delete_organization':
      return `Deleted ${organizationName || 'organization'}`;
    case 'save_audience_segment':
      return 'Audience segment saved';
    case 'draft_audience_message':
      return 'Message drafted';
    case 'create_campaign_draft':
      return 'Campaign draft created';
    case 'sync_to_action_network':
      return 'Synced to Action Network';
    default:
      return 'Action completed';
  }
}

function getConfirmButtonText(type: ConfirmationType) {
  switch (type) {
    case 'edit_collection':
    case 'edit_block':
    case 'edit_organization':
      return 'Yes, update';
    case 'add_resource':
    case 'add_block':
    case 'add_organization':
      return 'Yes, add';
    case 'delete_organization':
      return 'Yes, delete';
    case 'save_audience_segment':
      return 'Save segment';
    case 'draft_audience_message':
      return 'Use this draft';
    case 'create_campaign_draft':
      return 'Create draft';
    case 'sync_to_action_network':
      return 'Sync now';
    default:
      return 'Confirm';
  }
}

function ResourceTypeLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    marketing: 'Marketing',
    docs: 'Documentation',
    support: 'Support',
    other: 'Other',
  };
  return (
    <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
      {labels[type] || type}
    </span>
  );
}

function DiffLine({
  label,
  oldValue,
  newValue,
}: {
  label: string;
  oldValue?: string;
  newValue?: string;
}) {
  if (!newValue || oldValue === newValue) return null;

  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground font-medium">{label}:</div>
      {oldValue && (
        <div className="text-xs text-red-400/80 line-through pl-2">
          - {oldValue}
        </div>
      )}
      <div className="text-xs text-emerald-400/90 pl-2">+ {newValue}</div>
    </div>
  );
}

export function ConfirmationDisplay({
  type,
  confirmationId,
  preview,
  currentValues,
  collectionId,
  collectionName,
  blockId,
  organizationId,
  organizationName,
  onConfirm,
  onCancel,
  status,
  error,
}: ConfirmationDisplayProps) {
  const Icon = getIcon(type);
  const title = getTitle(type, collectionName, organizationName);
  const isPending = status === 'pending';
  const isLoading = status === 'loading';
  const isConfirmed = status === 'confirmed';
  const isCancelled = status === 'cancelled';
  const isError = status === 'error';

  const handleConfirm = async () => {
    const data: Record<string, any> = { ...preview };
    if (collectionId) data.collectionId = collectionId;
    if (blockId) data.blockId = blockId;
    if (organizationId) data.organizationId = organizationId;
    await onConfirm(confirmationId, type, data);
  };

  // Success state
  if (isConfirmed) {
    return (
      <div className="my-3 p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-medium text-emerald-400">
            {getSuccessMessage(type, collectionName, organizationName)}
          </span>
        </div>
        {collectionId && (
          <a
            href={`/app/library/collections/${collectionId}`}
            className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-400/80 hover:text-emerald-400 transition-colors"
          >
            View collection <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {organizationId && type !== 'delete_organization' && (
          <a
            href={`/app/organizations/${organizationId}`}
            className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-400/80 hover:text-emerald-400 transition-colors"
          >
            View organization <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    );
  }

  // Cancelled state
  if (isCancelled) {
    return (
      <div className="my-3 p-3 rounded-lg border border-border/30 bg-muted/10">
        <div className="flex items-center gap-2 text-muted-foreground">
          <XCircle className="w-4 h-4" />
          <span className="text-sm">Cancelled</span>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="my-3 p-4 rounded-lg border border-red-500/30 bg-red-500/10">
        <div className="flex items-center gap-2">
          <XCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm font-medium text-red-400">
            {error || 'Something went wrong'}
          </span>
        </div>
      </div>
    );
  }

  // Pending/Loading state - show confirmation UI
  return (
    <div className={cn(
      "my-3 p-4 rounded-lg border",
      type === 'delete_organization'
        ? "border-red-500/30 bg-red-500/5"
        : "border-primary/30 bg-primary/5"
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn("w-4 h-4", type === 'delete_organization' ? "text-red-400" : "text-primary")} />
        <span className="text-sm font-medium">{title}</span>
      </div>

      {/* Content based on type */}
      <div className="space-y-2 mb-4">
        {type === 'add_resource' && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{preview.label}</span>
              <ResourceTypeLabel type={preview.type} />
            </div>
            <a
              href={preview.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary/80 hover:text-primary truncate block"
            >
              {preview.url}
            </a>
          </>
        )}

        {type === 'edit_collection' && (
          <div className="space-y-2">
            <DiffLine
              label="Name"
              oldValue={currentValues?.name}
              newValue={preview.newName}
            />
            <DiffLine
              label="Owner"
              oldValue={currentValues?.owner}
              newValue={preview.newOwner}
            />
            <DiffLine
              label="Description"
              oldValue={currentValues?.description}
              newValue={preview.newDescription}
            />
          </div>
        )}

        {type === 'add_block' && (
          <>
            <div className="text-sm font-medium">{preview.title}</div>
            {preview.category && (
              <div className="text-xs text-muted-foreground">
                Category: {preview.category}
              </div>
            )}
            {preview.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {preview.description}
              </p>
            )}
          </>
        )}

        {type === 'edit_block' && (
          <div className="space-y-2">
            <DiffLine
              label="Category"
              oldValue={currentValues?.category}
              newValue={preview.category}
            />
            <DiffLine
              label="Title"
              oldValue={currentValues?.title}
              newValue={preview.title}
            />
            <DiffLine
              label="Description"
              oldValue={currentValues?.description}
              newValue={preview.description}
            />
          </div>
        )}

        {type === 'add_organization' && (
          <>
            <div className="text-sm font-medium">{preview.name}</div>
            {preview.status && (
              <div className="text-xs text-muted-foreground">Status: {preview.status}</div>
            )}
            {preview.type && (
              <div className="text-xs text-muted-foreground">Type: {preview.type}</div>
            )}
            {preview.website && (
              <div className="text-xs text-muted-foreground">Website: {preview.website}</div>
            )}
            {preview.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{preview.description}</p>
            )}
          </>
        )}

        {type === 'edit_organization' && (
          <div className="space-y-2">
            <DiffLine label="Name" oldValue={currentValues?.name} newValue={preview.newName} />
            <DiffLine label="Status" oldValue={currentValues?.status} newValue={preview.newStatus} />
            <DiffLine label="Type" oldValue={currentValues?.type} newValue={preview.newType} />
            <DiffLine label="Website" oldValue={currentValues?.website} newValue={preview.newWebsite} />
            <DiffLine label="Size" oldValue={currentValues?.size} newValue={preview.newSize} />
            <DiffLine label="Description" oldValue={currentValues?.description} newValue={preview.newDescription} />
          </div>
        )}

        {type === 'delete_organization' && (
          <div className="space-y-2">
            <div className="text-sm font-medium">{preview.name}</div>
            {preview.status && (
              <div className="text-xs text-muted-foreground">Status: {preview.status}</div>
            )}
            {preview.type && (
              <div className="text-xs text-muted-foreground">Type: {preview.type}</div>
            )}
            <div className="flex items-start gap-1.5 mt-2 p-2 rounded bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
              <span className="text-xs text-red-400">
                This will permanently delete this organization. This action cannot be undone.
              </span>
            </div>
          </div>
        )}

        {type === 'save_audience_segment' && (
          <div className="space-y-2">
            <div className="text-sm font-medium">{preview.name}</div>
            {preview.description && (
              <p className="text-xs text-muted-foreground">{preview.description}</p>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Estimated contacts: <span className="font-medium">{preview.estimatedCount?.toLocaleString()}</span></div>
              <div>Contactable (email): <span className="font-medium">{preview.contactableEmail?.toLocaleString()}</span></div>
            </div>
          </div>
        )}

        {type === 'draft_audience_message' && (
          <div className="space-y-2">
            <div className="text-sm font-medium">{preview.channel} — {preview.objective}</div>
            <div className="text-xs text-muted-foreground">Audience: {preview.audienceDescription}</div>
            <div className="text-xs text-muted-foreground">Tone: {preview.tone}</div>
            {preview.callToAction && (
              <div className="text-xs text-muted-foreground">CTA: {preview.callToAction}</div>
            )}
          </div>
        )}

        {type === 'create_campaign_draft' && (
          <div className="space-y-2">
            <div className="text-sm font-medium">{preview.segmentName}</div>
            <div className="text-xs text-muted-foreground">Channel: {preview.channel}</div>
            {preview.subject && (
              <div className="text-xs text-muted-foreground">Subject: {preview.subject}</div>
            )}
            <div className="text-xs text-muted-foreground">Recipients: {preview.estimatedRecipients?.toLocaleString()}</div>
            {preview.warning && (
              <div className="flex items-start gap-1.5 mt-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-yellow-600 dark:text-yellow-400">{preview.warning}</span>
              </div>
            )}
          </div>
        )}

        {type === 'sync_to_action_network' && (
          <div className="space-y-2">
            <div className="text-sm font-medium">{preview.segmentName}</div>
            <div className="text-xs text-muted-foreground">Tag: {preview.tagName}</div>
            <div className="text-xs text-muted-foreground">Contacts: {preview.contactableEmail?.toLocaleString()}</div>
            {preview.warning && (
              <div className="flex items-start gap-1.5 mt-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-yellow-600 dark:text-yellow-400">{preview.warning}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCancel(confirmationId)}
          disabled={isLoading}
          className="text-muted-foreground hover:text-foreground"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          variant={type === 'delete_organization' ? 'destructive' : 'default'}
          onClick={handleConfirm}
          disabled={isLoading}
          className="min-w-[90px]"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
              Saving...
            </>
          ) : (
            getConfirmButtonText(type)
          )}
        </Button>
      </div>
    </div>
  );
}
