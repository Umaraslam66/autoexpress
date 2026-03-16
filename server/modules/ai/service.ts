import { env } from '../../config/env.js';
import { AI_TOOLS, ChartConfig, executeTool } from './tools.js';

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatResponse {
  content: string;
  charts: ChartConfig[];
}

const SYSTEM_PROMPT = `You are an AI pricing analyst assistant for AutoXpress, an Irish used car dealership with ~490 vehicles in stock.

You have access to live inventory data through tools. When answering questions:
- Always use the available tools to fetch accurate, up-to-date data before answering
- Generate charts (via generate_chart) to visualise data whenever it would be helpful — e.g. breakdowns, distributions, comparisons
- Be concise and actionable; focus on pricing insights
- Use EUR for all prices
- If asked about general inventory stats, call get_inventory_summary first
- When showing grouped data (e.g. by make or fuel), consider generating a chart alongside your text answer`;

// OpenRouter uses the OpenAI-compatible chat completions API
async function callOpenRouter(messages: object[]): Promise<{ choices: { message: { role: string; content: string | null; tool_calls?: ToolCall[] } }[] }> {
  if (!env.openrouterApiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured.');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.openrouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://autoexpress.ie',
      'X-Title': 'AutoXpress Pricing Intelligence',
    },
    body: JSON.stringify({
      model: env.openrouterModel,
      messages,
      tools: AI_TOOLS,
      tool_choice: 'auto',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${text}`);
  }

  return response.json() as Promise<{ choices: { message: { role: string; content: string | null; tool_calls?: ToolCall[] } }[] }>;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export async function handleAiChat(userId: string, messages: AiChatMessage[]): Promise<AiChatResponse> {
  const charts: ChartConfig[] = [];

  // Build the message history with system prompt
  const conversationMessages: object[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  // Agentic loop: keep calling OpenRouter until no more tool calls
  let iterations = 0;
  const MAX_ITERATIONS = 8;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await callOpenRouter(conversationMessages);
    const message = response.choices[0]?.message;

    if (!message) {
      throw new Error('Empty response from OpenRouter.');
    }

    conversationMessages.push(message);

    // No tool calls — we have the final answer
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return {
        content: message.content ?? '',
        charts,
      };
    }

    // Execute each tool call and append results
    for (const toolCall of message.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
      } catch {
        args = {};
      }

      const result = await executeTool(toolCall.function.name, args, userId);

      if (result.chart) {
        charts.push(result.chart);
      }

      conversationMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result.content,
      });
    }
  }

  throw new Error('AI agent exceeded maximum tool call iterations.');
}
