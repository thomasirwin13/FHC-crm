import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const feedbackSchema = z.object({
  messageId: z.number(),
  helpful: z.boolean(),
  model: z.string().optional(),
  comment: z.string().max(1000).optional(),
});

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'No team' }, { status: 404 });
  }

  const body = await req.json();
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { messageId, helpful, model, comment } = parsed.data;

  const supabase = adminClient();
  const { error } = await supabase.from('ai_feedback').upsert(
    {
      team_id: team.id,
      user_id: user.id,
      message_id: messageId,
      model: model ?? null,
      helpful,
      comment: comment ?? null,
    },
    { onConflict: 'user_id,message_id' },
  );

  if (error) {
    console.error('[ai/feedback] Failed to save:', error.message);
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
