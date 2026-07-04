/**
 * Unit Tests: Zod Schema Validation
 *
 * Tests schema validation for Organization server actions.
 * Mirrors schema definitions from action files (not exported).
 *
 * Run with: pnpm test __tests__/unit/schemas/action-schemas.test.ts
 */

import { z } from 'zod';

/**
 * Mirror of createOrganizationSchema from app/app/organizations/actions.ts
 */
const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(255),
  description: z.string().optional(),
  website: z.string()
    .transform((val) => {
      if (!val) return '';
      if (val && !val.match(/^https?:\/\//)) {
        return `https://${val}`;
      }
      return val;
    })
    .pipe(z.string().url().optional().or(z.literal(''))),
  type: z.string().optional(),
  size: z.string().optional(),
  status: z.enum(['Lead', 'Opportunity', 'Client']).optional().default('Lead'),
});

/**
 * Mirror of deleteOrganizationSchema
 */
const deleteOrganizationSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)),
});

describe('createOrganizationSchema', () => {
  // Note: website is a required z.string() field (form always sends it, even as '').
  // All tests include website: '' to match form behavior.

  it('should accept valid name', () => {
    const result = createOrganizationSchema.safeParse({ name: 'Acme Corp', website: '' });
    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const result = createOrganizationSchema.safeParse({ name: '', website: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Organization name is required');
    }
  });

  it('should prepend https:// to website without protocol', () => {
    const result = createOrganizationSchema.safeParse({ name: 'Acme', website: 'example.com' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.website).toBe('https://example.com');
    }
  });

  it('should leave http:// website unchanged', () => {
    const result = createOrganizationSchema.safeParse({ name: 'Acme', website: 'http://example.com' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.website).toBe('http://example.com');
    }
  });

  it('should transform empty website to empty string', () => {
    const result = createOrganizationSchema.safeParse({ name: 'Acme', website: '' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.website).toBe('');
    }
  });

  it('should default status to "Lead"', () => {
    const result = createOrganizationSchema.safeParse({ name: 'Acme', website: '' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('Lead');
    }
  });

  it('should accept "Opportunity" status', () => {
    const result = createOrganizationSchema.safeParse({ name: 'Acme', status: 'Opportunity', website: '' });
    expect(result.success).toBe(true);
  });

  it('should accept "Client" status', () => {
    const result = createOrganizationSchema.safeParse({ name: 'Acme', status: 'Client', website: '' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid status', () => {
    const result = createOrganizationSchema.safeParse({ name: 'Acme', status: 'Invalid', website: '' });
    expect(result.success).toBe(false);
  });
});

describe('deleteOrganizationSchema', () => {
  it('should transform id string to int', () => {
    const result = deleteOrganizationSchema.safeParse({ id: '42' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(42);
    }
  });

  it('should reject missing id', () => {
    const result = deleteOrganizationSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
