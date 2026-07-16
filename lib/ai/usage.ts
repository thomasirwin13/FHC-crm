import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { UsageRecord } from './types';
import { estimateCost } from './models';
import { aiConfig } from './config';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function logUsage(record: UsageRecord): Promise<void> {
  const cost = record.estimatedCost
    ?? estimateCost(record.model, record.inputTokens ?? 0, record.outputTokens ?? 0);

  const supabase = adminClient();
  const { error } = await supabase.from('ai_usage').insert({
    team_id: record.teamId,
    user_id: record.userId ?? null,
    chat_id: record.chatId ?? null,
    feature: record.feature,
    workload: record.workload,
    model: record.model,
    provider: record.provider ?? null,
    input_tokens: record.inputTokens ?? null,
    output_tokens: record.outputTokens ?? null,
    estimated_cost: cost,
    latency_ms: record.latencyMs ?? null,
    request_id: record.requestId ?? null,
    tool_calls: record.toolCalls ?? 0,
    retrieval_count: record.retrievalCount ?? 0,
    succeeded: record.succeeded,
    error_code: record.errorCode ?? null,
  });

  if (error) {
    console.error('[ai/usage] Failed to log usage:', error.message);
  }
}

export async function getMonthlyUsageCents(teamId: number): Promise<number> {
  const supabase = adminClient();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data, error } = await supabase
    .from('ai_usage')
    .select('estimated_cost')
    .eq('team_id', teamId)
    .eq('succeeded', true)
    .gte('created_at', startOfMonth);

  if (error) {
    console.error('[ai/usage] Failed to fetch monthly usage:', error.message);
    return 0;
  }

  const totalDollars = (data ?? []).reduce((sum: number, row: any) => sum + (Number(row.estimated_cost) || 0), 0);
  return Math.round(totalDollars * 100);
}

export async function checkQuota(teamId: number): Promise<{ allowed: boolean; usedCents: number; budgetCents: number }> {
  const budgetCents = aiConfig.monthlyTeamBudgetCents;
  if (budgetCents <= 0) {
    return { allowed: true, usedCents: 0, budgetCents: 0 };
  }
  const usedCents = await getMonthlyUsageCents(teamId);
  return { allowed: usedCents < budgetCents, usedCents, budgetCents };
}
