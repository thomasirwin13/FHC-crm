import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateWebhook } from '@/lib/webhooks/auth';

const ALLOWED_FIELDS = [
  'name', 'email', 'email_secondary', 'phone', 'phone_secondary',
  'city', 'state', 'street', 'zip', 'regions',
  'engagement_level', 'outreach_frequency', 'preferred_contact_method',
  'background', 'action_committed', 'sms_consent',
  'organization_id',
] as const;

function pickFields(body: Record<string, any>, fields: readonly string[]) {
  const result: Record<string, any> = {};
  for (const key of fields) {
    if (key in body && body[key] !== undefined) {
      result[key] = body[key];
    }
  }
  return result;
}

export async function GET(request: Request) {
  const auth = await authenticateWebhook(request);
  if (auth instanceof Response) return auth;

  const supabase = createAdminClient();
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const { data, error } = await supabase
    .from('contacts')
    .select('id, name, email, phone, city, state, engagement_level, organization_id, created_at, updated_at')
    .eq('team_id', auth.teamId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contacts: data });
}

export async function POST(request: Request) {
  const auth = await authenticateWebhook(request);
  if (auth instanceof Response) return auth;

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: '"name" is required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (body.organization_name && !body.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('team_id', auth.teamId)
      .ilike('name', body.organization_name)
      .limit(1)
      .maybeSingle();

    if (org) {
      body.organization_id = org.id;
    }
  }

  const fields = pickFields(body, ALLOWED_FIELDS);

  const { data, error } = await supabase
    .from('contacts')
    .insert({ ...fields, name: body.name, team_id: auth.teamId, user_id: auth.userId } as any)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }

  await supabase.from('activity_logs').insert({
    team_id: auth.teamId,
    user_id: auth.userId,
    action: 'CREATE_CONTACT',
    ip_address: request.headers.get('x-forwarded-for') || 'webhook',
  });

  return NextResponse.json({ contact: data }, { status: 201 });
}

export async function PUT(request: Request) {
  const auth = await authenticateWebhook(request);
  if (auth instanceof Response) return auth;

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.id && !body.email) {
    return NextResponse.json(
      { error: 'Provide "id" or "email" to identify the contact to update' },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  let contactId: number | null = body.id ?? null;

  if (!contactId && body.email) {
    const { data: found } = await supabase
      .from('contacts')
      .select('id')
      .eq('team_id', auth.teamId)
      .eq('email', body.email)
      .limit(1)
      .maybeSingle();

    if (!found) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }
    contactId = found.id;
  }

  const fields = pickFields(body, ALLOWED_FIELDS);
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('contacts')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', contactId!)
    .eq('team_id', auth.teamId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }

  await supabase.from('activity_logs').insert({
    team_id: auth.teamId,
    user_id: auth.userId,
    action: 'UPDATE_CONTACT',
    ip_address: request.headers.get('x-forwarded-for') || 'webhook',
  });

  return NextResponse.json({ contact: data });
}
