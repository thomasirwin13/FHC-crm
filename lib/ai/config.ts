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

export const aiConfig = {
  get gatewayApiKey() {
    return env('AI_GATEWAY_API_KEY', process.env.OPENAI_API_KEY ?? '');
  },
  get defaultModel() {
    return env('AI_DEFAULT_MODEL', 'gpt-5.2');
  },
  get advancedModel() {
    return env('AI_ADVANCED_MODEL', 'gpt-5.2');
  },
  get embeddingModel() {
    return env('AI_EMBEDDING_MODEL', 'text-embedding-3-small');
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
} as const;
