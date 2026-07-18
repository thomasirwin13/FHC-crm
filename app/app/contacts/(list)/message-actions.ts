'use server';

import { generateObject } from 'ai';
import { z } from 'zod';
import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';
import { createClient } from '@/lib/supabase/server';
import { getLanguageModel, getModelParams } from '@/lib/ai/gateway';
import { logUsage } from '@/lib/ai/usage';
import { checkQuota } from '@/lib/ai/usage';

const messageResultSchema = z.object({
  messages: z.array(z.object({
    contactId: z.number(),
    subject: z.string(),
    body: z.string(),
  })),
});

export interface GeneratedMessage {
  contactId: number;
  contactName: string;
  contactEmail: string | null;
  subject: string;
  body: string;
}

export async function generateContactMessagesAction(
  contactIds: number[],
  prompt: string,
  channel: 'email' | 'text' | 'whatsapp',
) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const quota = await checkQuota(team.id);
  if (!quota.allowed) return { error: 'Monthly AI usage limit reached.' };

  if (contactIds.length === 0) return { error: 'No contacts selected' };
  if (contactIds.length > 50) return { error: 'Maximum 50 contacts per batch' };
  if (!prompt.trim()) return { error: 'Please provide a message goal' };

  const supabase = await createClient();
  const { data: contacts, error: fetchError } = await supabase
    .from('contacts')
    .select('id, name, email, phone, city, state, regions, engagement_level, background, action_committed, organization:organizations!contacts_organization_id_fkey(id, name)')
    .eq('team_id', team.id)
    .in('id', contactIds);

  if (fetchError || !contacts || contacts.length === 0) {
    return { error: 'Failed to fetch contacts' };
  }

  const contactSummaries = contacts.map((c: any) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    city: c.city,
    state: c.state,
    regions: c.regions || [],
    engagement: c.engagement_level || 'potential',
    background: c.background || null,
    committed: c.action_committed || false,
    organization: c.organization?.name || null,
  }));

  const channelGuidance = channel === 'email'
    ? 'Write professional but warm emails with a subject line and body. Use paragraph breaks.'
    : channel === 'text'
    ? 'Write brief, conversational text messages. Keep under 300 characters. Subject should be a short label for internal reference only.'
    : 'Write brief, friendly WhatsApp messages. Keep concise. Subject should be a short label for internal reference only.';

  const { modelId } = getModelParams('draft');
  const startTime = Date.now();

  try {
    const { object, usage } = await generateObject({
      model: getLanguageModel('draft'),
      schema: messageResultSchema,
      prompt: `You are a community organizer's assistant. Generate personalized ${channel} messages for the following contacts.

**Goal:** ${prompt}

**Channel guidance:** ${channelGuidance}

**Contacts:**
${contactSummaries.map((c, i) => `
${i + 1}. contactId: ${c.id}
   Name: ${c.name}
   ${c.email ? `Email: ${c.email}` : ''}
   ${c.phone ? `Phone: ${c.phone}` : ''}
   ${c.city || c.state ? `Location: ${[c.city, c.state].filter(Boolean).join(', ')}` : ''}
   ${c.regions.length > 0 ? `Region: ${c.regions.join(', ')}` : ''}
   Engagement level: ${c.engagement}
   ${c.committed ? 'Committed to weekly action: Yes' : ''}
   ${c.organization ? `Organization: ${c.organization}` : ''}
   ${c.background ? `Background: ${c.background}` : ''}
`).join('')}

**Rules:**
- Personalize each message using the contact's name, organization, location, and background when relevant
- Adapt tone to engagement level: be more introductory for "potential", more direct and action-oriented for "activist"
- Do not fabricate information about the contact
- Keep the overall goal consistent across all messages
- Return exactly one message per contact, using their contactId`,
    });

    logUsage({
      teamId: team.id,
      userId: user.id,
      feature: 'contact_messages',
      workload: 'draft',
      model: modelId,
      provider: 'openai',
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      latencyMs: Date.now() - startTime,
      succeeded: true,
    }).catch(() => {});

    const contactMap = new Map(contacts.map((c: any) => [c.id, c]));
    const messages: GeneratedMessage[] = object.messages.map((m) => {
      const contact = contactMap.get(m.contactId) as any;
      return {
        contactId: m.contactId,
        contactName: contact?.name ?? 'Unknown',
        contactEmail: contact?.email ?? null,
        subject: m.subject,
        body: m.body,
      };
    });

    return { success: true, messages };
  } catch (e) {
    console.error('[message-actions] AI generation failed:', e);

    logUsage({
      teamId: team.id,
      userId: user.id,
      feature: 'contact_messages',
      workload: 'draft',
      model: modelId,
      provider: 'openai',
      latencyMs: Date.now() - startTime,
      succeeded: false,
      errorCode: e instanceof Error ? e.message.slice(0, 100) : 'unknown',
    }).catch(() => {});

    return { error: 'Failed to generate messages. Please try again.' };
  }
}
