import 'server-only';

import { tool } from 'ai';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { resolveActionNetworkKey } from '@/lib/integrations';
import type { ToolContext } from './registry';

export function createIntegrationTools(ctx: ToolContext) {
  return {
    syncAudienceToActionNetwork: tool({
      description:
        'Propose syncing or tagging contacts from a saved audience segment to Action Network. Returns a confirmation preview — does NOT execute the sync automatically. Requires Action Network integration to be configured.',
      inputSchema: z.object({
        audienceSegmentId: z.number().int().describe('ID of the audience segment to sync'),
        tagName: z.string().min(1).max(200).describe('Tag name to apply in Action Network'),
      }),
      execute: async ({ audienceSegmentId, tagName }) => {
        ctx.onToolCall?.();

        const apiKey = await resolveActionNetworkKey(ctx.teamId);
        if (!apiKey) {
          return { error: 'Action Network integration is not configured. Go to Settings → Integrations to add your API key.' };
        }

        const supabase = await createClient();
        const { data: segment } = await supabase
          .from('audience_segments')
          .select('id, name, estimated_count, contactable_email, filter_definition')
          .eq('id', audienceSegmentId)
          .eq('team_id', ctx.teamId)
          .single();

        if (!segment) {
          return { error: 'Audience segment not found or access denied.' };
        }

        return {
          needsConfirmation: true,
          confirmationType: 'sync_to_action_network',
          preview: {
            segmentName: segment.name,
            segmentId: segment.id,
            estimatedContacts: segment.estimated_count,
            contactableEmail: segment.contactable_email,
            tagName,
            platform: 'Action Network',
            warning: `This will tag up to ${segment.contactable_email} contacts with "${tagName}" in Action Network. No emails will be sent. You can review contacts before confirming.`,
          },
          data: { audienceSegmentId, tagName },
        };
      },
    }),
  };
}
