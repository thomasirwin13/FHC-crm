import 'server-only';

import { createClient } from '@/lib/supabase/server';
import {
  type ReportDefinition,
  type FilterCondition,
  type EntityType,
  REPORTABLE_ENTITIES,
  validateReportFields,
  reportDefinitionSchema,
} from './schema';
import { applySuppressionFilters, type ContactabilityStats } from './suppression';

export interface ReportResult {
  rows: Record<string, unknown>[];
  totalCount: number;
  contactability?: ContactabilityStats;
  appliedFilters: FilterCondition[];
  entityType: EntityType;
}

export async function runReport(
  teamId: number,
  definition: ReportDefinition,
): Promise<ReportResult> {
  const parsed = reportDefinitionSchema.parse(definition);
  const validation = validateReportFields(parsed);
  if (!validation.valid) {
    throw new Error(`Invalid report: ${validation.errors.join(', ')}`);
  }

  const supabase = await createClient();
  const selectFields = parsed.selectedFields.join(', ');

  let query = supabase
    .from(parsed.entityType)
    .select(selectFields, { count: 'exact' })
    .eq('team_id', teamId);

  query = applyFilters(query, parsed.filters);

  if (parsed.sort) {
    query = query.order(parsed.sort.field, {
      ascending: parsed.sort.direction === 'asc',
    });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  query = query.limit(parsed.limit);

  const { data, error, count } = await query;
  if (error) throw new Error(`Report query failed: ${error.message}`);

  let contactability: ContactabilityStats | undefined;
  if (parsed.entityType === 'contacts') {
    contactability = await getContactability(teamId, parsed.filters);
  }

  return {
    rows: (data as unknown as Record<string, unknown>[]) || [],
    totalCount: count ?? 0,
    contactability,
    appliedFilters: parsed.filters,
    entityType: parsed.entityType,
  };
}

export async function previewAudienceFromFilters(
  teamId: number,
  filters: FilterCondition[],
  sampleSize: number = 5,
): Promise<{
  totalMatching: number;
  contactability: ContactabilityStats;
  sample: Array<{ id: number; name: string; email: string | null; city: string | null; engagement_level: string | null }>;
  previewId: string;
}> {
  const supabase = await createClient();

  let countQuery = supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId);
  countQuery = applyFilters(countQuery, filters);
  const { count: totalMatching } = await countQuery;

  const contactability = await getContactability(teamId, filters);

  let sampleQuery = supabase
    .from('contacts')
    .select('id, name, email, city, engagement_level')
    .eq('team_id', teamId);
  sampleQuery = applyFilters(sampleQuery, filters);
  sampleQuery = applySuppressionFilters(sampleQuery, 'email');
  const { data: sampleData } = await sampleQuery.limit(sampleSize);

  const previewId = `preview_${teamId}_${Date.now()}`;

  return {
    totalMatching: totalMatching ?? 0,
    contactability,
    sample: (sampleData ?? []) as any[],
    previewId,
  };
}

async function getContactability(
  teamId: number,
  filters: FilterCondition[],
): Promise<ContactabilityStats> {
  const supabase = await createClient();

  let baseQuery = supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId);
  baseQuery = applyFilters(baseQuery, filters);
  const { count: total } = await baseQuery;

  let emailQuery = supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId);
  emailQuery = applyFilters(emailQuery, filters);
  emailQuery = applySuppressionFilters(emailQuery, 'email');
  const { count: emailContactable } = await emailQuery;

  let smsQuery = supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId);
  smsQuery = applyFilters(smsQuery, filters);
  smsQuery = applySuppressionFilters(smsQuery, 'sms');
  const { count: smsContactable } = await smsQuery;

  const totalCount = total ?? 0;
  const emailCount = emailContactable ?? 0;
  const smsCount = smsContactable ?? 0;

  return {
    totalMatching: totalCount,
    contactableEmail: emailCount,
    contactableSms: smsCount,
    excluded: totalCount - emailCount,
  };
}

function applyFilters(query: any, filters: FilterCondition[]): any {
  for (const f of filters) {
    switch (f.operator) {
      case 'eq':
        query = query.eq(f.field, f.value);
        break;
      case 'neq':
        query = query.neq(f.field, f.value);
        break;
      case 'gt':
        query = query.gt(f.field, f.value);
        break;
      case 'gte':
        query = query.gte(f.field, f.value);
        break;
      case 'lt':
        query = query.lt(f.field, f.value);
        break;
      case 'lte':
        query = query.lte(f.field, f.value);
        break;
      case 'like':
        query = query.like(f.field, f.value as string);
        break;
      case 'ilike':
        query = query.ilike(f.field, f.value as string);
        break;
      case 'is_null':
        query = query.is(f.field, null);
        break;
      case 'is_not_null':
        query = query.not(f.field, 'is', null);
        break;
      case 'in':
        query = query.in(f.field, f.value as string[]);
        break;
      case 'contains':
        query = query.contains(f.field, f.value);
        break;
      case 'contained_by':
        query = query.containedBy(f.field, f.value);
        break;
    }
  }
  return query;
}
