import 'server-only';

import { createOpenAI } from '@ai-sdk/openai';
import type { AIWorkload } from './types';
import { getRouteForWorkload } from './models';
import { aiConfig, parseModelString } from './config';

function getProvider() {
  return createOpenAI({
    apiKey: aiConfig.gatewayApiKey,
  });
}

export function getLanguageModel(workload: AIWorkload) {
  const route = getRouteForWorkload(workload);
  const { modelId } = parseModelString(route.resolvedModel);
  return getProvider()(modelId);
}

export function getEmbeddingModel() {
  const { modelId } = parseModelString(aiConfig.embeddingModel);
  return getProvider().embedding(modelId);
}

export function getModelParams(workload: AIWorkload) {
  const route = getRouteForWorkload(workload);
  const parsed = parseModelString(route.resolvedModel);
  return {
    model: getProvider()(parsed.modelId),
    modelId: route.resolvedModel,
    temperature: route.temperature,
    maxOutputTokens: route.maxOutputTokens ?? aiConfig.maxOutputTokens,
    maxToolSteps: route.maxToolSteps ?? aiConfig.maxToolSteps,
  };
}

export async function testConnection(): Promise<{ ok: boolean; model: string; error?: string }> {
  const { modelId } = aiConfig.defaultModelParsed;
  try {
    const provider = getProvider();
    const model = provider(modelId);
    const { generateText } = await import('ai');
    await generateText({
      model,
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
