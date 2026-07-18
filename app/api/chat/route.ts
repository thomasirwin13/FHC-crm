import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';
import { createChat, saveMessage } from '@/app/app/chat/actions';
import { getModelParams } from '@/lib/ai/gateway';
import { logUsage } from '@/lib/ai/usage';
import { checkQuota } from '@/lib/ai/usage';
import { CHAT_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { createAllTools } from '@/lib/ai/tools/registry';
import {
  convertToModelMessages,
  streamText,
  UIMessage,
  stepCountIs,
} from 'ai';
import { NextResponse } from 'next/server';

function getTextFromMessage(message: UIMessage): string {
  if (!message.parts) return '';
  for (const part of message.parts) {
    if (part.type === 'text' && 'text' in part) {
      return (part as { type: 'text'; text: string }).text;
    }
  }
  return '';
}

export const maxDuration = 30;

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'User not part of a team' }, { status: 404 });
  }

  const quota = await checkQuota(team.id);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: 'Monthly AI usage limit reached. Please contact your administrator.' },
      { status: 429 },
    );
  }

  const { messages, chatId }: { messages: UIMessage[]; chatId?: number } = await req.json();

  let currentChatId = chatId;
  if (!currentChatId && messages.length > 0) {
    const firstUserMessage = messages.find((m: UIMessage) => m.role === 'user');
    const messageText = firstUserMessage ? getTextFromMessage(firstUserMessage) : '';
    const titleText = messageText.substring(0, 40) || 'New chat';
    try {
      const newChat = await createChat(user.id, team.id, titleText);
      currentChatId = newChat.id;
    } catch (error) {
      console.error('Error creating chat:', error);
      return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 });
    }
  }

  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === 'user' && currentChatId) {
    const messageText = getTextFromMessage(lastMessage);
    if (messageText) {
      try {
        await saveMessage(user.id, team.id, currentChatId, 'user', messageText);
      } catch (error) {
        console.error('Error saving user message:', error);
      }
    }
  }

  const { model, modelId, temperature, maxOutputTokens, maxToolSteps } = getModelParams('chat');
  const startTime = Date.now();
  let toolCallCount = 0;

  const tools = createAllTools({
    teamId: team.id,
    userId: user.id,
    onToolCall: () => { toolCallCount++; },
  });

  const result = streamText({
    model,
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(maxToolSteps),
    temperature,
    maxOutputTokens,
    system: CHAT_SYSTEM_PROMPT,
    onFinish: async ({ text, usage }) => {
      if (currentChatId && text) {
        try {
          await saveMessage(user.id, team.id, currentChatId, 'assistant', text);
        } catch (error) {
          console.error('Error saving assistant message:', error);
        }
      }

      logUsage({
        teamId: team.id,
        userId: user.id,
        chatId: currentChatId,
        feature: 'chat',
        workload: 'chat',
        model: modelId,
        provider: 'openai',
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        latencyMs: Date.now() - startTime,
        toolCalls: toolCallCount,
        succeeded: true,
      }).catch((e) => console.error('[ai/usage] log failed:', e));
    },
    tools,
  });

  const response = result.toUIMessageStreamResponse();

  if (currentChatId) {
    response.headers.set('X-Chat-Id', currentChatId.toString());
  }

  return response;
}
