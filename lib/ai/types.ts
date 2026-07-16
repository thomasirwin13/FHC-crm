import 'server-only';

export type AIWorkload =
  | 'chat'
  | 'summary'
  | 'extraction'
  | 'draft'
  | 'semantic_search'
  | 'strategy'
  | 'complex_analysis';

export type AIProvider = 'openai' | 'anthropic';

export interface ModelDef {
  provider: AIProvider;
  modelId: string;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
}

export interface WorkloadRoute {
  workload: AIWorkload;
  modelKey: string;
  maxOutputTokens?: number;
  temperature?: number;
  maxToolSteps?: number;
}

export interface UsageRecord {
  teamId: number;
  userId?: number;
  chatId?: number;
  feature: string;
  workload: AIWorkload;
  model: string;
  provider?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
  latencyMs?: number;
  requestId?: string;
  toolCalls?: number;
  retrievalCount?: number;
  succeeded: boolean;
  errorCode?: string;
}

export interface Citation {
  sourceType: string;
  sourceId: number;
  chunkId?: string;
  sourceTitle?: string;
  excerpt?: string;
  rank?: number;
  similarityScore?: number;
}

export interface AIRequestContext {
  teamId: number;
  userId: number;
  workload: AIWorkload;
  feature: string;
  chatId?: number;
}
