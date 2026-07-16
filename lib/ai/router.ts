import 'server-only';

import type { AIWorkload, AIRequestContext } from './types';
import { getRouteForWorkload } from './models';
import { getModelParams } from './gateway';

export function resolveRequest(ctx: AIRequestContext) {
  const route = getRouteForWorkload(ctx.workload);
  const params = getModelParams(ctx.workload);

  return {
    ...params,
    workload: ctx.workload,
    feature: ctx.feature,
    teamId: ctx.teamId,
    userId: ctx.userId,
    chatId: ctx.chatId,
  };
}
