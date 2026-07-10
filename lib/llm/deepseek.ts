import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-pro';
export const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com';

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.DEEP_SEEK_API ?? process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('DEEP_SEEK_API is not set');
    client = new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL });
  }
  return client;
}

const MAX_LLM_ATTEMPTS = 5;

async function chatCompletionWithRetry(
  messages: ChatCompletionMessageParam[],
  tools: ChatCompletionTool[] | undefined,
  maxTokens: number,
) {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      return await getClient().chat.completions.create({
        model: DEEPSEEK_MODEL,
        messages,
        tools,
        temperature: 0.1,
        max_tokens: maxTokens,
        // DeepSeek V4 defaults to thinking-on, which silently eats max_tokens.
        // @ts-expect-error — DeepSeek-specific extra; OpenAI SDK passes unknown fields through.
        thinking: { type: 'disabled' },
      });
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      const is429 = /\b429\b|rate[\s-]?limit|RESOURCE_EXHAUSTED|quota/i.test(msg);
      const is5xx = /\b5\d\d\b|ECONNRESET|ETIMEDOUT|fetch failed/i.test(msg);
      if ((!is429 && !is5xx) || attempt >= MAX_LLM_ATTEMPTS) throw e;
      const backoffMs = Math.min(60_000, 2_000 * 2 ** (attempt - 1));
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: any) => unknown | Promise<unknown>;
}

/**
 * Runs a multi-turn tool-calling agent loop: the model can request tool calls,
 * we execute them and feed results back, until it returns a final text answer
 * or maxIterations is hit.
 */
export async function runToolAgent(opts: {
  systemPrompt: string;
  userPrompt: string;
  tools: ToolDef[];
  maxIterations?: number;
  maxTokens?: number;
}): Promise<string> {
  const maxIterations = opts.maxIterations ?? 8;
  const maxTokens = opts.maxTokens ?? 4096;

  const toolSchema: ChatCompletionTool[] = opts.tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
  const toolsByName = new Map(opts.tools.map((t) => [t.name, t]));

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: opts.systemPrompt },
    { role: 'user', content: opts.userPrompt },
  ];

  for (let i = 0; i < maxIterations; i++) {
    const res = await chatCompletionWithRetry(messages, toolSchema, maxTokens);
    const message = res.choices[0]?.message;
    if (!message) throw new Error('empty LLM response');

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return message.content ?? '';
    }

    messages.push(message);
    for (const call of message.tool_calls) {
      if (call.type !== 'function') continue;
      const tool = toolsByName.get(call.function.name);
      let result: unknown;
      if (!tool) {
        result = { error: `unknown tool: ${call.function.name}` };
      } else {
        try {
          const args = JSON.parse(call.function.arguments || '{}');
          result = await tool.handler(args);
        } catch (e) {
          result = { error: String((e as Error)?.message ?? e) };
        }
      }
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  throw new Error(`tool agent did not converge within ${maxIterations} iterations`);
}
