import 'server-only';

import { openai } from '@ai-sdk/openai';
import type { AIWorkload } from './types';
import { getRouteForWorkload } from './models';
import { aiConfig } from './config';

export function getLanguageModel(workload: AIWorkload) {
  const route = getRouteForWorkload(workload);
  return openai(route.resolvedModel);
}

export function getEmbeddingModel() {
  return openai.embedding(aiConfig.embeddingModel);
}

export function getModelParams(workload: AIWorkload) {
  const route = getRouteForWorkload(workload);
  return {
    model: openai(route.resolvedModel),
    modelId: route.resolvedModel,
    temperature: route.temperature,
    maxOutputTokens: route.maxOutputTokens ?? aiConfig.maxOutputTokens,
    maxToolSteps: route.maxToolSteps ?? aiConfig.maxToolSteps,
  };
}
