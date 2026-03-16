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

You have access to live inventory data through function tools. When answering questions:
- ALWAYS call the relevant tool(s) first to get real data before answering — never guess or make up numbers
- Call generate_chart via the tool whenever visualising data would help — do NOT write chart JSON in your text response
- Be concise and actionable; focus on pricing insights
- Use EUR for all prices
- For general inventory questions, call get_inventory_summary first
- When showing grouped data (by make, fuel, etc.), also call generate_chart to visualise it

IMPORTANT: Use the provided function-calling tools only. Never output tool call JSON or code blocks in your text response.`;

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

// ─── Embedded chart extraction (fallback for models that don't use native tool calling) ──

interface RawChartBlock {
  type?: unknown;
  title?: unknown;
  data?: unknown;
  x_label?: unknown;
  y_label?: unknown;
}

function tryParseChartBlock(raw: unknown): ChartConfig | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const block = raw as RawChartBlock;
  if (!block.type || !block.title || !Array.isArray(block.data)) return null;
  return {
    type: block.type as ChartConfig['type'],
    title: String(block.title),
    data: block.data as ChartConfig['data'],
    xLabel: block.x_label ? String(block.x_label) : undefined,
    yLabel: block.y_label ? String(block.y_label) : undefined,
  };
}

function looseParsePythonDict(str: string): unknown {
  // Convert Python-style dict string to valid JSON
  const json = str
    .replace(/'/g, '"')
    .replace(/True/g, 'true')
    .replace(/False/g, 'false')
    .replace(/None/g, 'null');
  return JSON.parse(json);
}

function extractEmbeddedCharts(text: string): { cleanText: string; charts: ChartConfig[] } {
  const charts: ChartConfig[] = [];

  // Pattern 1: {"action": "generate_chart", "action_input": {...} or "..."}
  let cleanText = text.replace(/\{[^{}]*"action"\s*:\s*"generate_chart"[^{}]*"action_input"\s*:\s*([\s\S]*?)\}\s*\}/g, (match, actionInput: string) => {
    try {
      let inputVal: unknown;
      const trimmed = actionInput.trim();
      // action_input might be a nested object or a string
      if (trimmed.startsWith('{')) {
        inputVal = JSON.parse(trimmed.endsWith('}') ? trimmed : trimmed + '}');
      } else if (trimmed.startsWith('"')) {
        // Quoted string — unescape it then parse as Python dict
        const unquoted = JSON.parse(trimmed) as string;
        inputVal = looseParsePythonDict(unquoted);
      } else {
        inputVal = looseParsePythonDict(trimmed);
      }
      const chart = tryParseChartBlock(inputVal);
      if (chart) charts.push(chart);
      return '';
    } catch {
      return match;
    }
  });

  // Pattern 2: ```json ... ``` code fences containing chart JSON
  cleanText = cleanText.replace(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/g, (match, jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr) as unknown;
      const chart = tryParseChartBlock(parsed);
      if (chart) { charts.push(chart); return ''; }
      // Check if it's an action wrapper
      if (typeof parsed === 'object' && parsed !== null && 'action' in parsed) {
        const p = parsed as { action: unknown; action_input: unknown };
        if (p.action === 'generate_chart') {
          const inner = typeof p.action_input === 'string'
            ? looseParsePythonDict(p.action_input)
            : p.action_input;
          const chart2 = tryParseChartBlock(inner);
          if (chart2) { charts.push(chart2); return ''; }
        }
      }
    } catch { /* keep as-is */ }
    return match;
  });

  return { cleanText: cleanText.trim(), charts };
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
      const rawContent = message.content ?? '';
      // Fallback: some models output chart calls as inline JSON instead of function calls.
      // Parse them out so the frontend can still render the charts.
      const { cleanText, charts: embeddedCharts } = extractEmbeddedCharts(rawContent);
      charts.push(...embeddedCharts);
      return { content: cleanText, charts };
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
