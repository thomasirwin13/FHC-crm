/**
 * Unit Tests: AI Gateway Configuration
 *
 * Tests parseModelString, validateConfig, and aiConfig from lib/ai/config.ts.
 *
 * Run with: pnpm test __tests__/unit/ai/gateway-config.test.ts
 */

// Must mock 'server-only' since it throws outside Next.js
jest.mock('server-only', () => ({}));

import { parseModelString, validateConfig } from '@/lib/ai/config';

describe('parseModelString', () => {
  it('splits provider/model format correctly', () => {
    expect(parseModelString('openai/gpt-5-mini')).toEqual({
      provider: 'openai',
      modelId: 'gpt-5-mini',
    });
  });

  it('handles model with multiple slashes', () => {
    const result = parseModelString('openai/gpt-5/turbo');
    expect(result.provider).toBe('openai');
    expect(result.modelId).toBe('gpt-5/turbo');
  });

  it('defaults to openai provider when no slash', () => {
    expect(parseModelString('gpt-5-mini')).toEqual({
      provider: 'openai',
      modelId: 'gpt-5-mini',
    });
  });

  it('handles empty string gracefully', () => {
    const result = parseModelString('');
    expect(result.provider).toBe('openai');
    expect(result.modelId).toBe('');
  });
});

describe('validateConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns valid when AI_GATEWAY_API_KEY is set', () => {
    process.env.AI_GATEWAY_API_KEY = 'test-key';
    delete process.env.OPENAI_API_KEY;
    expect(validateConfig()).toEqual({ valid: true });
  });

  it('returns valid when OPENAI_API_KEY is set as fallback', () => {
    delete process.env.AI_GATEWAY_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-test';
    expect(validateConfig()).toEqual({ valid: true });
  });

  it('returns invalid when neither key is set', () => {
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const result = validateConfig();
    expect(result.valid).toBe(false);
    expect(result.error).toContain('AI_GATEWAY_API_KEY');
  });
});
