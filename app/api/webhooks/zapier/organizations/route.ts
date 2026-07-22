import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateWebhook } from '@/lib/webhooks/auth';

const ALLOWED_FIELDS = [
  'name', 'type', 'status', 'size', 'website', 'description',
  'city', 'state', 'street', 'zip', 'regions',
  'engagement_level', 'priority_follow_up',
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
    .from('organizations')
    .select('id, name, type, status, city, state, website, engagement_level, created_at, updated_at')
    .eq('team_id', auth.teamId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ organizations: data });
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
  const fields = pickFields(body, ALLOWED_FIELDS);

  const { data, error } = await supabase
    .from('organizations')
    .insert({ ...fields, name: body.name, team_id: auth.teamId, user_id: auth.userId } as any)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }

  await supabase.from('activity_logs').insert({
    team_id: auth.teamId,
    user_id: auth.userId,
    action: 'CREATE_ORGANIZATION',
    ip_address: request.headers.get('x-forwarded-for') || 'webhook',
  });

  return NextResponse.json({ organization: data }, { status: 201 });
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

  if (!body.id && !body.name) {
    return NextResponse.json(
      { error: 'Provide "id" or "name" to identify the organization to update' },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  let orgId: number | null = body.id ?? null;

  if (!orgId && body.name) {
    const { data: found } = await supabase
      .from('organizations')
      .select('id')
      .eq('team_id', auth.teamId)
      .ilike('name', body.name)
      .limit(1)
      .maybeSingle();

    if (!found) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    orgId = found.id;
  }

  const fields = pickFields(body, ALLOWED_FIELDS);
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('organizations')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', orgId!)
    .eq('team_id', auth.teamId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }

  await supabase.from('activity_logs').insert({
    team_id: auth.teamId,
    user_id: auth.userId,
    action: 'UPDATE_ORGANIZATION',
    ip_address: request.headers.get('x-forwarded-for') || 'webhook',
  });

  return NextResponse.json({ organization: data });
}
