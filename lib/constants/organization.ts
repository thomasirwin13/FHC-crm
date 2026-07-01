import { z } from 'zod';

// ── Organization Engagement Statuses ─────────────────────────────────────────
export const ORGANIZATION_STATUSES = [
  'Potential Lead',
  'Contact Made',
  'Active Members',
  'Starting Church Team',
  'Active Church Team',
] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];
export const organizationStatusSchema = z.enum(ORGANIZATION_STATUSES);
export const DEFAULT_ORGANIZATION_STATUS: OrganizationStatus = 'Potential Lead';

/** For <Select> / dropdown UI components */
export const organizationStatusOptions = ORGANIZATION_STATUSES.map((s, i) => ({
  value: s,
  label: `${i}) ${s}`,
}));

// ── Organization Sizes ───────────────────────────────────────────────────────────
export const ORGANIZATION_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1000+',
] as const;
export type OrganizationSize = (typeof ORGANIZATION_SIZES)[number];
export const organizationSizeSchema = z.enum(ORGANIZATION_SIZES);

/** For <Select> / dropdown UI components */
export const organizationSizeOptions = ORGANIZATION_SIZES.map((s) => ({
  value: s,
  label: `${s} employees`,
}));
