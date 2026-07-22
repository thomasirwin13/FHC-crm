import 'server-only';

import type { ModelDef, WorkloadRoute, AIWorkload } from './types';
import { aiConfig, parseModelString } from './config';

const MODEL_REGISTRY: Record<string, ModelDef> = {
  'gpt-5-mini': {
    provider: 'openai',
    modelId: 'gpt-5-mini',
    displayName: 'GPT-5 Mini',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    costPer1kInput: 0.0004,
    costPer1kOutput: 0.0016,
    supportsTools: true,
    supportsStreaming: true,
  },
  'gpt-5.5': {
    provider: 'openai',
    modelId: 'gpt-5.5',
    displayName: 'GPT-5.5',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    costPer1kInput: 0.002,
    costPer1kOutput: 0.008,
    supportsTools: true,
    supportsStreaming: true,
  },
  'gpt-5.2': {
    provider: 'openai',
    modelId: 'gpt-5.2',
    displayName: 'GPT-5.2',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    costPer1kInput: 0.002,
    costPer1kOutput: 0.008,
    supportsTools: true,
    supportsStreaming: true,
  },
  'gpt-4.1': {
    provider: 'openai',
    modelId: 'gpt-4.1',
    displayName: 'GPT-4.1',
    contextWindow: 1047576,
    maxOutputTokens: 32768,
    costPer1kInput: 0.002,
    costPer1kOutput: 0.008,
    supportsTools: true,
    supportsStreaming: true,
  },
  'gpt-4.1-mini': {
    provider: 'openai',
    modelId: 'gpt-4.1-mini',
    displayName: 'GPT-4.1 Mini',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    costPer1kInput: 0.0004,
    costPer1kOutput: 0.0016,
    supportsTools: true,
    supportsStreaming: true,
  },
  'text-embedding-3-small': {
    provider: 'openai',
    modelId: 'text-embedding-3-small',
    displayName: 'Text Embedding 3 Small',
    contextWindow: 8191,
    maxOutputTokens: 0,
    costPer1kInput: 0.00002,
    costPer1kOutput: 0,
    supportsTools: false,
    supportsStreaming: false,
  },
};

const WORKLOAD_ROUTES: WorkloadRoute[] = [
  { workload: 'chat', modelKey: 'default', temperature: 0.7, maxToolSteps: 8 },
  { workload: 'summary', modelKey: 'default', temperature: 0.3 },
  { workload: 'extraction', modelKey: 'default', temperature: 0.0 },
  { workload: 'draft', modelKey: 'default', temperature: 0.7 },
  { workload: 'semantic_search', modelKey: 'embedding' },
  { workload: 'strategy', modelKey: 'advanced', temperature: 0.5, maxToolSteps: 8 },
  { workload: 'complex_analysis', modelKey: 'advanced', temperature: 0.3 },
];

function resolveModelKey(key: string): string {
  switch (key) {
    case 'default': return aiConfig.defaultModel;
    case 'advanced': return aiConfig.advancedModel;
    case 'embedding': return aiConfig.embeddingModel;
    default: return key;
  }
}

export function getModelDef(modelId: string): ModelDef | undefined {
  const { modelId: bare } = parseModelString(modelId);
  return MODEL_REGISTRY[bare] ?? MODEL_REGISTRY[modelId];
}

export function getRouteForWorkload(workload: AIWorkload): WorkloadRoute & { resolvedModel: string } {
  const route = WORKLOAD_ROUTES.find(r => r.workload === workload);
  if (!route) {
    return {
      workload,
      modelKey: 'default',
      resolvedModel: aiConfig.defaultModel,
      temperature: 0.7,
    };
  }
  return { ...route, resolvedModel: resolveModelKey(route.modelKey) };
}

export function estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
  const def = getModelDef(modelId);
  if (!def) return 0;
  return (inputTokens / 1000) * def.costPer1kInput + (outputTokens / 1000) * def.costPer1kOutput;
}

export function listModels(): ModelDef[] {
  return Object.values(MODEL_REGISTRY);
}
