import 'server-only';

const BLOCKLIST = new Set([
  'api_key',
  'apiKey',
  'secret',
  'password',
  'token',
  'ssn',
  'social_security',
  'credit_card',
  'card_number',
  'bank_account',
  'routing_number',
  'stripe_customer_id',
]);

export function redactFields<T extends Record<string, unknown>>(
  obj: T,
  extraBlocklist?: string[],
): T {
  const blocked = extraBlocklist
    ? new Set([...BLOCKLIST, ...extraBlocklist])
    : BLOCKLIST;

  const result = { ...obj };
  for (const key of Object.keys(result)) {
    if (blocked.has(key)) {
      (result as any)[key] = '[REDACTED]';
    }
  }
  return result;
}

export function sanitizeForContext(
  records: Record<string, unknown>[],
  allowedFields?: string[],
): Record<string, unknown>[] {
  return records.map(record => {
    if (allowedFields) {
      const filtered: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (field in record) {
          filtered[field] = record[field];
        }
      }
      return redactFields(filtered);
    }
    return redactFields(record);
  });
}
