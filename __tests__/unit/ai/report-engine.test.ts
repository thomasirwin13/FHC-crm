/**
 * Unit Tests: Report Schema Validation and Engine
 *
 * Tests the allowlist validation, Zod schemas, and suppression rule descriptions
 * from lib/ai/reports/schema.ts and lib/ai/reports/suppression.ts.
 *
 * Run with: pnpm test __tests__/unit/ai/report-engine.test.ts
 */

// Must mock 'server-only' since it throws outside Next.js
jest.mock('server-only', () => ({}));

import {
  REPORTABLE_ENTITIES,
  ALLOWED_OPERATORS,
  filterConditionSchema,
  reportDefinitionSchema,
  validateReportFields,
  DISTRICT_TYPES,
  DISTRICT_FIELD_MAP,
  type ReportDefinition,
} from '@/lib/ai/reports/schema';

import { describeSuppressionRules } from '@/lib/ai/reports/suppression';

// ───────────────────────────── Schema allowlist tests ─────────────────────────

describe('REPORTABLE_ENTITIES allowlist', () => {
  it('exposes contacts and organizations only', () => {
    const keys = Object.keys(REPORTABLE_ENTITIES);
    expect(keys).toEqual(['contacts', 'organizations']);
  });

  it('contacts entity has expected fields', () => {
    const fields = Object.keys(REPORTABLE_ENTITIES.contacts.fields);
    expect(fields).toContain('name');
    expect(fields).toContain('email');
    expect(fields).toContain('engagement_level');
    expect(fields).toContain('bounced');
    expect(fields).toContain('suppressed');
    expect(fields).toContain('sms_consent');
    expect(fields).toContain('congressional_district');
  });

  it('does not expose internal or dangerous fields', () => {
    const contactFields = Object.keys(REPORTABLE_ENTITIES.contacts.fields);
    expect(contactFields).not.toContain('team_id');
    expect(contactFields).not.toContain('password');
    expect(contactFields).not.toContain('api_key');
    expect(contactFields).not.toContain('action_network_id');
  });
});

// ───────────────────────────── Zod filter schema tests ───────────────────────

describe('filterConditionSchema', () => {
  it('accepts valid string filter', () => {
    const result = filterConditionSchema.safeParse({
      field: 'city',
      operator: 'eq',
      value: 'Chicago',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid boolean filter', () => {
    const result = filterConditionSchema.safeParse({
      field: 'bounced',
      operator: 'eq',
      value: false,
    });
    expect(result.success).toBe(true);
  });

  it('accepts array value for in operator', () => {
    const result = filterConditionSchema.safeParse({
      field: 'state',
      operator: 'in',
      value: ['CA', 'NY', 'TX'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid operator', () => {
    const result = filterConditionSchema.safeParse({
      field: 'name',
      operator: 'DROP TABLE',
      value: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing field', () => {
    const result = filterConditionSchema.safeParse({
      operator: 'eq',
      value: 'x',
    });
    expect(result.success).toBe(false);
  });
});

// ───────────────────────────── reportDefinitionSchema tests ─────────────────

describe('reportDefinitionSchema', () => {
  it('accepts a valid minimal report', () => {
    const result = reportDefinitionSchema.safeParse({
      entityType: 'contacts',
      filters: [],
      selectedFields: ['name', 'email'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(100); // default
    }
  });

  it('rejects unknown entity types', () => {
    const result = reportDefinitionSchema.safeParse({
      entityType: 'users',
      filters: [],
      selectedFields: ['name'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty selectedFields', () => {
    const result = reportDefinitionSchema.safeParse({
      entityType: 'contacts',
      filters: [],
      selectedFields: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects limit above 500', () => {
    const result = reportDefinitionSchema.safeParse({
      entityType: 'contacts',
      filters: [],
      selectedFields: ['name'],
      limit: 1000,
    });
    expect(result.success).toBe(false);
  });
});

// ───────────────────────────── validateReportFields tests ────────────────────

describe('validateReportFields', () => {
  it('passes for valid contacts fields', () => {
    const def: ReportDefinition = {
      entityType: 'contacts',
      filters: [{ field: 'city', operator: 'eq', value: 'Chicago' }],
      selectedFields: ['name', 'email', 'city'],
      limit: 100,
    };
    expect(validateReportFields(def)).toEqual({ valid: true, errors: [] });
  });

  it('rejects disallowed selectedField', () => {
    const def: ReportDefinition = {
      entityType: 'contacts',
      filters: [],
      selectedFields: ['name', 'team_id'],
      limit: 100,
    };
    const result = validateReportFields(def);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Field 'team_id' is not allowed on contacts");
  });

  it('rejects disallowed filter field', () => {
    const def: ReportDefinition = {
      entityType: 'contacts',
      filters: [{ field: 'password_hash', operator: 'eq', value: 'x' }],
      selectedFields: ['name'],
      limit: 100,
    };
    const result = validateReportFields(def);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('password_hash');
  });

  it('rejects disallowed sort field', () => {
    const def: ReportDefinition = {
      entityType: 'contacts',
      filters: [],
      selectedFields: ['name'],
      sort: { field: 'internal_score', direction: 'desc' },
      limit: 100,
    };
    const result = validateReportFields(def);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('internal_score');
  });

  it('rejects disallowed groupBy field', () => {
    const def: ReportDefinition = {
      entityType: 'organizations',
      filters: [],
      selectedFields: ['name'],
      groupBy: 'api_key',
      limit: 100,
    };
    const result = validateReportFields(def);
    expect(result.valid).toBe(false);
  });

  it('validates organization fields correctly', () => {
    const def: ReportDefinition = {
      entityType: 'organizations',
      filters: [{ field: 'status', operator: 'eq', value: 'active' }],
      selectedFields: ['name', 'status', 'city'],
      limit: 50,
    };
    expect(validateReportFields(def)).toEqual({ valid: true, errors: [] });
  });
});

// ───────────────────────────── District types ────────────────────────────────

describe('DISTRICT_TYPES', () => {
  it('includes expected district types', () => {
    expect(DISTRICT_TYPES).toContain('congressional');
    expect(DISTRICT_TYPES).toContain('state_senate');
    expect(DISTRICT_TYPES).toContain('state_assembly');
  });

  it('DISTRICT_FIELD_MAP maps contact fields to types', () => {
    expect(DISTRICT_FIELD_MAP.congressional_district).toBe('congressional');
    expect(DISTRICT_FIELD_MAP.state_senate_district).toBe('state_senate');
  });
});

// ───────────────────────────── Suppression rules ─────────────────────────────

describe('describeSuppressionRules', () => {
  it('returns non-empty description for email channel', () => {
    const desc = describeSuppressionRules('email');
    expect(desc.length).toBeGreaterThan(10);
    expect(desc).toContain('email');
  });

  it('returns non-empty description for sms channel', () => {
    const desc = describeSuppressionRules('sms');
    expect(desc.length).toBeGreaterThan(10);
    expect(desc).toContain('SMS consent');
  });

  it('returns sms/whatsapp-specific rules for whatsapp channel', () => {
    const desc = describeSuppressionRules('whatsapp');
    expect(desc).toContain('phone');
    expect(desc).toContain('SMS consent');
  });
});

// ───────────────────────────── ALLOWED_OPERATORS ─────────────────────────────

describe('ALLOWED_OPERATORS', () => {
  it('does not include SQL injection vectors', () => {
    const ops = [...ALLOWED_OPERATORS];
    expect(ops).not.toContain('raw');
    expect(ops).not.toContain('sql');
    expect(ops).not.toContain('exec');
  });

  it('includes all expected comparison operators', () => {
    expect(ALLOWED_OPERATORS).toContain('eq');
    expect(ALLOWED_OPERATORS).toContain('neq');
    expect(ALLOWED_OPERATORS).toContain('gt');
    expect(ALLOWED_OPERATORS).toContain('lt');
    expect(ALLOWED_OPERATORS).toContain('ilike');
  });
});
