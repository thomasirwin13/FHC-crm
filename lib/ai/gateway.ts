import 'server-only';

import type { AIWorkload } from './types';
import { getRouteForWorkload } from './models';
import { aiConfig } from './config';

export function getLanguageModel(workload: AIWorkload) {
  const route = getRouteForWorkload(workload);
  return route.resolvedModel as any;
}

export function getEmbeddingModel() {
  return aiConfig.embeddingModel as any;
}

export function getModelParams(workload: AIWorkload) {
  const route = getRouteForWorkload(workload);
  return {
    model: route.resolvedModel as any,
    modelId: route.resolvedModel,
    temperature: route.temperature,
    maxOutputTokens: route.maxOutputTokens ?? aiConfig.maxOutputTokens,
    maxToolSteps: route.maxToolSteps ?? aiConfig.maxToolSteps,
  };
}

export async function testConnection(): Promise<{ ok: boolean; model: string; error?: string }> {
  try {
    const { generateText } = await import('ai');
    await generateText({
      model: aiConfig.defaultModel as any,
      prompt: 'Reply with exactly: ok',
      maxOutputTokens: 5,
    });
    return { ok: true, model: aiConfig.defaultModel };
  } catch (e) {
    return {
      ok: false,
      model: aiConfig.defaultModel,
      error: e instanceof Error ? e.message.slice(0, 200) : 'Unknown error',
    };
  }
}
