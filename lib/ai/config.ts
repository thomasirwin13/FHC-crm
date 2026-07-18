import 'server-only';

function env(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (v === undefined) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return v;
}

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  return v ? parseInt(v, 10) : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (!v) return fallback;
  return v === 'true' || v === '1';
}

export interface ParsedModelString {
  provider: string;
  modelId: string;
}

export function parseModelString(raw: string): ParsedModelString {
  const slash = raw.indexOf('/');
  if (slash > 0) {
    return { provider: raw.slice(0, slash), modelId: raw.slice(slash + 1) };
  }
  return { provider: 'openai', modelId: raw };
}

let _validated = false;

export function validateConfig(): { valid: boolean; error?: string } {
  const key = process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) {
    return { valid: false, error: 'Neither AI_GATEWAY_API_KEY nor OPENAI_API_KEY is set' };
  }
  _validated = true;
  return { valid: true };
}

export const aiConfig = {
  get gatewayApiKey(): string {
    const key = process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error(
        'AI configuration error: neither AI_GATEWAY_API_KEY nor OPENAI_API_KEY is set. ' +
        'Set AI_GATEWAY_API_KEY for Vercel AI Gateway or OPENAI_API_KEY for direct OpenAI access.',
      );
    }
    return key;
  },
  get defaultModel() {
    return env('AI_DEFAULT_MODEL', 'openai/gpt-5-mini');
  },
  get advancedModel() {
    return env('AI_ADVANCED_MODEL', 'openai/gpt-5.5');
  },
  get embeddingModel() {
    return env('AI_EMBEDDING_MODEL', 'openai/text-embedding-3-small');
  },
  get defaultModelParsed(): ParsedModelString {
    return parseModelString(this.defaultModel);
  },
  get advancedModelParsed(): ParsedModelString {
    return parseModelString(this.advancedModel);
  },
  get embeddingModelParsed(): ParsedModelString {
    return parseModelString(this.embeddingModel);
  },
  get providerAllowlist(): string[] {
    return env('AI_PROVIDER_ALLOWLIST', 'openai').split(',').map(s => s.trim());
  },
  get zeroDataRetention() {
    return envBool('AI_ZERO_DATA_RETENTION', true);
  },
  get disallowPromptTraining() {
    return envBool('AI_DISALLOW_PROMPT_TRAINING', true);
  },
  get maxOutputTokens() {
    return envInt('AI_MAX_OUTPUT_TOKENS', 4096);
  },
  get maxToolSteps() {
    return envInt('AI_MAX_TOOL_STEPS', 5);
  },
  get monthlyTeamBudgetCents() {
    return envInt('AI_MONTHLY_TEAM_BUDGET_CENTS', 0);
  },
  get embeddingDimensions() {
    return 1536;
  },
  get isValidated() {
    return _validated;
  },
} as const;
