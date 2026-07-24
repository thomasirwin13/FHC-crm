import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractContactFromEmail } from '@/lib/ai/extract-contact';

export const maxDuration = 30;

interface WebhookAuth {
  teamId: number;
  userId: number;
}

async function authenticateRequest(request: Request): Promise<WebhookAuth | Response> {
  const url = new URL(request.url);
  const keyFromQuery = url.searchParams.get('key');
  const authHeader = request.headers.get('authorization');
  const keyFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  const apiKey = keyFromQuery || keyFromHeader;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing API key. Pass as ?key= query param or Authorization: Bearer header.' },
      { status: 401 },
    );
  }

  const supabase = createAdminClient();

  const { data: integration } = await supabase
    .from('team_integrations')
    .select('team_id')
    .eq('provider', 'zapier')
    .eq('api_key', apiKey)
    .maybeSingle();

  if (!integration) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  const { data: owner } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', integration.team_id)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle();

  if (!owner) {
    return NextResponse.json({ error: 'Team has no owner' }, { status: 500 });
  }

  return { teamId: integration.team_id, userId: owner.user_id };
}

function normalizeEmailPayload(body: Record<string, any>): {
  from: string;
  subject: string;
  textBody: string;
} | null {
  // SendGrid Inbound Parse (JSON mode)
  if (body.from && body.subject && (body.text || body.html)) {
    return {
      from: body.from,
      subject: body.subject,
      textBody: body.text || stripHtml(body.html),
    };
  }

  // Postmark Inbound
  if (body.FromFull || body.From) {
    const from = body.FromFull
      ? `${body.FromFull.Name || ''} <${body.FromFull.Email}>`.trim()
      : body.From;
    return {
      from,
      subject: body.Subject || body.subject || '(no subject)',
      textBody: body.TextBody || body.text || stripHtml(body.HtmlBody || body.html || ''),
    };
  }

  // Resend / generic JSON
  if (body.from && (body.text || body.html || body.body)) {
    return {
      from: typeof body.from === 'object' ? `${body.from.name || ''} <${body.from.email}>`.trim() : body.from,
      subject: body.subject || '(no subject)',
      textBody: body.text || body.body || stripHtml(body.html || ''),
    };
  }

  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  let body: Record<string, any>;
  const contentType = request.headers.get('content-type') || '';

  try {
    if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries());
    } else {
      body = await request.json();
    }
  } catch {
    return NextResponse.json({ error: 'Could not parse request body' }, { status: 400 });
  }

  const email = normalizeEmailPayload(body);
  if (!email) {
    return NextResponse.json(
      { error: 'Could not parse email data. Expected fields: from, subject, text/html/body' },
      { status: 400 },
    );
  }

  if (!email.textBody.trim()) {
    return NextResponse.json({ error: 'Email body is empty' }, { status: 400 });
  }

  let extracted;
  try {
    extracted = await extractContactFromEmail({
      from: email.from,
      subject: email.subject,
      body: email.textBody,
    });
  } catch (err) {
    console.error('AI extraction failed:', err);
    return NextResponse.json(
      { error: 'Failed to extract contact information from email' },
      { status: 500 },
    );
  }

  if (!extracted.name) {
    return NextResponse.json(
      { error: 'Could not determine a contact name from the email' },
      { status: 422 },
    );
  }

  const supabase = createAdminClient();

  // Check for duplicate by email
  if (extracted.email) {
    const { data: existing } = await supabase
      .from('contacts')
      .select('id, name')
      .eq('team_id', auth.teamId)
      .eq('email', extracted.email)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          message: 'Contact with this email already exists',
          existing_contact: existing,
          extracted,
        },
        { status: 200 },
      );
    }
  }

  // Look up organization by name
  let organizationId: number | null = null;
  if (extracted.organization) {
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('team_id', auth.teamId)
      .ilike('name', extracted.organization)
      .limit(1)
      .maybeSingle();

    if (org) {
      organizationId = org.id;
    }
  }

  const { data: contact, error } = await supabase
    .from('contacts')
    .insert({
      name: extracted.name,
      email: extracted.email,
      email_secondary: extracted.email_secondary,
      phone: extracted.phone,
      phone_secondary: extracted.phone_secondary,
      street: extracted.street,
      city: extracted.city,
      state: extracted.state,
      zip: extracted.zip,
      background: extracted.background,
      team_id: auth.teamId,
      user_id: auth.userId,
    } as any)
    .select()
    .single();

  if (error) {
    console.error('Failed to create contact:', error);
    return NextResponse.json({ error: error.message }, { status: 422 });
  }

  // Link to organization if found
  if (organizationId && contact) {
    await supabase
      .from('contact_organizations')
      .insert({ contact_id: contact.id, organization_id: organizationId, team_id: auth.teamId } as any);
  }

  await supabase.from('activity_logs').insert({
    team_id: auth.teamId,
    user_id: auth.userId,
    action: 'CREATE_CONTACT',
    ip_address: request.headers.get('x-forwarded-for') || 'inbound-email',
  });

  return NextResponse.json(
    {
      message: 'Contact created from email',
      contact,
      extracted,
      organization_matched: organizationId ? true : false,
    },
    { status: 201 },
  );
}
