import 'server-only';

import { tool } from 'ai';
import { z } from 'zod';
import { filterConditionSchema } from '@/lib/ai/reports/schema';
import { createClient } from '@/lib/supabase/server';
import type { ToolContext } from './registry';

export function createCampaignTools(ctx: ToolContext) {
  return {
    draftAudienceMessage: tool({
      description:
        'Draft a message template for an audience segment. Generates one template with approved merge fields (e.g. {{first_name}}), not individual messages per contact. Returns a confirmation preview — does not save until confirmed.',
      inputSchema: z.object({
        audienceSegmentId: z.number().int().optional().describe('ID of a saved audience segment, if one exists'),
        audienceDescription: z.string().describe('Human-readable description of the audience (e.g. "contacts in State Senate District 26")'),
        channel: z.enum(['email', 'sms', 'whatsapp']).default('email'),
        objective: z.string().describe('The communication objective (e.g. "invite to community meeting")'),
        tone: z.enum(['formal', 'friendly', 'urgent', 'informational']).default('friendly'),
        callToAction: z.string().optional().describe('Specific call to action (e.g. "RSVP by Friday")'),
        districtContext: z.string().optional().describe('District or campaign context to include'),
      }),
      execute: async ({ audienceSegmentId, audienceDescription, channel, objective, tone, callToAction, districtContext }) => {
        ctx.onToolCall?.();

        const mergeFields = ['{{first_name}}', '{{organization}}', '{{city}}'];
        const channelGuidance = channel === 'email'
          ? 'Professional email with subject line and paragraphs.'
          : channel === 'sms'
          ? 'Brief text message under 160 characters. No subject needed.'
          : 'Concise WhatsApp message. No subject needed.';

        return {
          needsConfirmation: true,
          confirmationType: 'draft_audience_message',
          preview: {
            audienceSegmentId: audienceSegmentId ?? null,
            audienceDescription,
            channel,
            objective,
            tone,
            callToAction: callToAction ?? null,
            districtContext: districtContext ?? null,
            channelGuidance,
            availableMergeFields: mergeFields,
            instructions: 'Draft a message template using the merge fields above. The user will review before any messages are sent.',
          },
        };
      },
    }),

    createCampaignDraft: tool({
      description:
        'Create a campaign draft linked to an audience segment. Does NOT send the campaign — it creates a draft that requires explicit approval. Returns a confirmation preview.',
      inputSchema: z.object({
        audienceSegmentId: z.number().int().describe('ID of the audience segment'),
        channel: z.enum(['email', 'sms', 'whatsapp']).default('email'),
        subject: z.string().optional().describe('Email subject line (required for email channel)'),
        messageBody: z.string().describe('Message body text (may contain merge fields like {{first_name}})'),
        tone: z.string().optional(),
        callToAction: z.string().optional(),
        districtContext: z.string().optional(),
      }),
      execute: async ({ audienceSegmentId, channel, subject, messageBody, tone, callToAction, districtContext }) => {
        ctx.onToolCall?.();

        const supabase = await createClient();
        const { data: segment, error } = await supabase
          .from('audience_segments')
          .select('id, name, estimated_count, contactable_email, contactable_sms')
          .eq('id', audienceSegmentId)
          .eq('team_id', ctx.teamId)
          .single();

        if (error || !segment) {
          return { error: 'Audience segment not found or access denied.' };
        }

        const contactableCount = channel === 'email'
          ? segment.contactable_email
          : segment.contactable_sms;

        return {
          needsConfirmation: true,
          confirmationType: 'create_campaign_draft',
          preview: {
            segmentName: segment.name,
            segmentId: segment.id,
            channel,
            subject: subject ?? null,
            messageBody,
            tone: tone ?? null,
            callToAction: callToAction ?? null,
            districtContext: districtContext ?? null,
            estimatedRecipients: contactableCount,
            totalInSegment: segment.estimated_count,
            status: 'draft',
            warning: `This will create a DRAFT campaign for ${contactableCount} contactable recipients. No messages will be sent until you explicitly approve.`,
          },
          data: { audienceSegmentId, channel, subject, messageBody, tone, callToAction, districtContext },
        };
      },
    }),
  };
}
