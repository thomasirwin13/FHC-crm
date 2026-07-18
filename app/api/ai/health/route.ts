import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';
import { validateConfig } from '@/lib/ai/config';
import { testConnection } from '@/lib/ai/gateway';
import { NextResponse } from 'next/server';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'No team found' }, { status: 404 });
  }

  const membership = (team as any).teamMembers?.find(
    (m: any) => m.userId === user.id,
  );
  if (!membership || membership.role !== 'owner') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const configCheck = validateConfig();
  if (!configCheck.valid) {
    return NextResponse.json({
      status: 'error',
      stage: 'configuration',
      message: configCheck.error,
    }, { status: 500 });
  }

  const connectionCheck = await testConnection();
  if (!connectionCheck.ok) {
    return NextResponse.json({
      status: 'error',
      stage: 'connection',
      model: connectionCheck.model,
      message: connectionCheck.error,
    }, { status: 502 });
  }

  return NextResponse.json({
    status: 'ok',
    model: connectionCheck.model,
    configValid: true,
    connectionValid: true,
  });
}
