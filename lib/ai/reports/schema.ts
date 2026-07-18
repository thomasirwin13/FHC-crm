import 'server-only';

import { z } from 'zod';

export const REPORTABLE_ENTITIES = {
  contacts: {
    label: 'Contacts',
    fields: {
      name: { type: 'text', label: 'Name' },
      email: { type: 'text', label: 'Email' },
      phone: { type: 'text', label: 'Phone' },
      city: { type: 'text', label: 'City' },
      state: { type: 'text', label: 'State' },
      zip: { type: 'text', label: 'ZIP' },
      county: { type: 'text', label: 'County' },
      engagement_level: { type: 'enum', label: 'Engagement level', values: ['activist', 'attender', 'participator', 'learner', 'potential'] },
      action_committed: { type: 'boolean', label: 'Committed to action' },
      subscription_status: { type: 'enum', label: 'Subscription status', values: ['active', 'inactive', 'pending'] },
      bounced: { type: 'boolean', label: 'Bounced' },
      suppressed: { type: 'boolean', label: 'Suppressed' },
      sms_consent: { type: 'boolean', label: 'SMS consent' },
      preferred_contact_method: { type: 'text', label: 'Preferred contact method' },
      regions: { type: 'array', label: 'Regions' },
      congressional_district: { type: 'text', label: 'Congressional district' },
      state_senate_district: { type: 'text', label: 'State senate district' },
      state_assembly_district: { type: 'text', label: 'State assembly district' },
      created_at: { type: 'timestamp', label: 'Created' },
      updated_at: { type: 'timestamp', label: 'Updated' },
    },
  },
  organizations: {
    label: 'Organizations',
    fields: {
      name: { type: 'text', label: 'Name' },
      status: { type: 'enum', label: 'Status', values: ['prospect', 'active', 'onboarding', 'churned', 'inactive'] },
      type: { type: 'text', label: 'Type' },
      size: { type: 'text', label: 'Size' },
      engagement_level: { type: 'enum', label: 'Engagement level', values: ['activist', 'attender', 'participator', 'learner', 'potential'] },
      city: { type: 'text', label: 'City' },
      state: { type: 'text', label: 'State' },
      regions: { type: 'array', label: 'Regions' },
      priority_follow_up: { type: 'boolean', label: 'Priority follow-up' },
      created_at: { type: 'timestamp', label: 'Created' },
      updated_at: { type: 'timestamp', label: 'Updated' },
    },
  },
} as const;

export type EntityType = keyof typeof REPORTABLE_ENTITIES;

export const ALLOWED_OPERATORS = [
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
  'like', 'ilike', 'is_null', 'is_not_null',
  'in', 'contains', 'contained_by',
] as const;

export type FilterOperator = typeof ALLOWED_OPERATORS[number];

export const ALLOWED_AGGREGATES = ['count', 'count_distinct'] as const;
export type AggregateFunction = typeof ALLOWED_AGGREGATES[number];

export const ALLOWED_SORT_DIRECTIONS = ['asc', 'desc'] as const;

export const filterConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(ALLOWED_OPERATORS),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]),
});

export type FilterCondition = z.infer<typeof filterConditionSchema>;

export const filterDefinitionSchema = z.array(filterConditionSchema);

export const sortDefinitionSchema = z.object({
  field: z.string(),
  direction: z.enum(ALLOWED_SORT_DIRECTIONS),
});

export const reportDefinitionSchema = z.object({
  entityType: z.enum(['contacts', 'organizations']),
  filters: filterDefinitionSchema,
  selectedFields: z.array(z.string()).min(1).max(20),
  sort: sortDefinitionSchema.optional(),
  groupBy: z.string().optional(),
  aggregate: z.enum(ALLOWED_AGGREGATES).optional(),
  limit: z.number().int().min(1).max(500).default(100),
});

export type ReportDefinition = z.infer<typeof reportDefinitionSchema>;

export function validateReportFields(def: ReportDefinition): { valid: boolean; errors: string[] } {
  const entity = REPORTABLE_ENTITIES[def.entityType];
  if (!entity) return { valid: false, errors: [`Unknown entity: ${def.entityType}`] };

  const allowedFields = Object.keys(entity.fields);
  const errors: string[] = [];

  for (const field of def.selectedFields) {
    if (!allowedFields.includes(field)) {
      errors.push(`Field '${field}' is not allowed on ${def.entityType}`);
    }
  }

  for (const filter of def.filters) {
    if (!allowedFields.includes(filter.field)) {
      errors.push(`Filter field '${filter.field}' is not allowed on ${def.entityType}`);
    }
  }

  if (def.sort && !allowedFields.includes(def.sort.field)) {
    errors.push(`Sort field '${def.sort.field}' is not allowed on ${def.entityType}`);
  }

  if (def.groupBy && !allowedFields.includes(def.groupBy)) {
    errors.push(`Group-by field '${def.groupBy}' is not allowed on ${def.entityType}`);
  }

  return { valid: errors.length === 0, errors };
}

export const DISTRICT_TYPES = [
  'congressional',
  'state_senate',
  'state_assembly',
  'county_supervisor',
  'city_council',
] as const;

export type DistrictType = typeof DISTRICT_TYPES[number];

export const DISTRICT_FIELD_MAP: Record<string, DistrictType> = {
  congressional_district: 'congressional',
  state_senate_district: 'state_senate',
  state_assembly_district: 'state_assembly',
};
