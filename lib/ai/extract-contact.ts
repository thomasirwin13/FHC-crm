import 'server-only';

import { generateObject } from 'ai';
import { z } from 'zod';
import { getModelParams } from './gateway';

const contactSchema = z.object({
  name: z.string().describe('Full name of the contact'),
  email: z.string().nullable().describe('Primary email address'),
  email_secondary: z.string().nullable().describe('Secondary email address, if found'),
  phone: z.string().nullable().describe('Primary phone number'),
  phone_secondary: z.string().nullable().describe('Secondary phone number'),
  organization: z.string().nullable().describe('Company or organization name'),
  street: z.string().nullable().describe('Street address'),
  city: z.string().nullable().describe('City'),
  state: z.string().nullable().describe('State or province (use 2-letter abbreviation for US states)'),
  zip: z.string().nullable().describe('ZIP or postal code'),
  background: z.string().nullable().describe('Brief summary of who this person is and any relevant context from the email'),
});

export type ExtractedContact = z.infer<typeof contactSchema>;

const EXTRACTION_PROMPT = `You are a contact information extraction specialist for a CRM system.

Given an email (which may be a direct email from someone, or a forwarded email), extract contact information for the person who should be added as a new contact.

Rules:
- If this is a FORWARDED email, extract the contact info of the ORIGINAL sender (the person whose email was forwarded), NOT the person who forwarded it.
- Look for contact details in email signatures, which often contain phone numbers, addresses, titles, and organization names.
- Look for contact details in email headers (From, Reply-To).
- If the email body contains contact information (e.g., in a signature block), use that.
- For US phone numbers, normalize to (XXX) XXX-XXXX format.
- For US states, use 2-letter abbreviations (e.g., CA, NY, TX).
- Set any field to null if the information is not found.
- The "background" field should be a 1-2 sentence summary of context from the email (what they do, why they reached out, any relevant details).
- The "name" field is required — if you can only find an email address, use the part before @ as the name (e.g., "john.smith" → "John Smith").`;

export async function extractContactFromEmail(email: {
  from: string;
  subject: string;
  body: string;
}): Promise<ExtractedContact> {
  const { model, temperature } = getModelParams('extraction');

  const result = await generateObject({
    model,
    schema: contactSchema,
    temperature,
    prompt: `${EXTRACTION_PROMPT}

--- EMAIL ---
From: ${email.from}
Subject: ${email.subject}

${email.body}
--- END EMAIL ---

Extract the contact information from this email.`,
  });

  return result.object;
}
