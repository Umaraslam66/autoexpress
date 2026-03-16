import { useEffect, useRef, useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { ChartRenderer } from '../components/ui/ChartRenderer';
import type { ChartConfig } from '../components/ui/ChartRenderer';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  charts?: ChartConfig[];
  isLoading?: boolean;
}

const SUGGESTED_PROMPTS = [
  'Give me a full inventory summary with a chart',
  'Which cars are above market? Show me a breakdown by make',
  'Show the distribution of fuel types in our stock',
  'What are our top 10 most expensive vehicles?',
  'Which cars have been in stock the longest?',
  'Compare average price by transmission type',
  'How many vehicles are below market price?',
  'Show pricing position distribution as a pie chart',
];

const WELCOME: ChatMessage = {
  role: 'assistant',
  content: "Hello! I'm your AutoXpress AI pricing analyst. I have live access to your inventory, pricing data, and market comparables. Ask me anything — I can search vehicles, analyse pricing positions, generate charts, and more.",
};

export function AIAgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isFirstInteraction = messages.length === 1;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    const loadingMessage: ChatMessage = { role: 'assistant', content: '', isLoading: true };

    setMessages((prev) => [...prev, userMessage, loadingMessage]);
    setInput('');
    setIsLoading(true);

    // Build history excluding the welcome message and loading placeholder
    const history: { role: 'user' | 'assistant'; content: string }[] = [
      ...messages.filter((m) => !m.isLoading && m !== WELCOME).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: trimmed },
    ];

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json() as { message?: string };
        throw new Error(err.message ?? `Server error ${res.status}`);
      }

      const data = await res.json() as { content: string; charts: ChartConfig[] };

      setMessages((prev) => [
        ...prev.filter((m) => !m.isLoading),
        { role: 'assistant', content: data.content, charts: data.charts },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setMessages((prev) => [
        ...prev.filter((m) => !m.isLoading),
        { role: 'assistant', content: `Error: ${message}` },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  function clearChat() {
    setMessages([WELCOME]);
    setInput('');
  }

  return (
    <AppShell
      title="AI Insights"
      subtitle="Ask questions about your inventory, pricing positions, and market data. Charts generated automatically."
      actions={
        messages.length > 1 ? (
          <button type="button" className="ghost-button" onClick={clearChat}>
            Clear chat
          </button>
        ) : undefined
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', gap: '0' }}>

        {/* Messages area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 16px' }}>

          {/* Suggested prompts — only shown before first user message */}
          {isFirstInteraction && (
            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '12px', opacity: 0.5, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Suggested queries
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px' }}>
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(99, 102, 241, 0.08)',
                      border: '1px solid rgba(99, 102, 241, 0.2)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '13px',
                      color: 'inherit',
                      lineHeight: 1.4,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99, 102, 241, 0.16)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)')}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
          </div>
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingTop: '16px',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your inventory… (Enter to send, Shift+Enter for new line)"
              disabled={isLoading}
              rows={2}
              style={{
                flex: 1,
                resize: 'none',
                padding: '10px 14px',
                fontSize: '14px',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)',
                color: 'inherit',
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.5,
                opacity: isLoading ? 0.6 : 1,
              }}
            />
            <button
              type="button"
              className="primary-button"
              onClick={() => void sendMessage(input)}
              disabled={isLoading || !input.trim()}
              style={{ height: '60px', minWidth: '80px', flexShrink: 0 }}
            >
              {isLoading ? '…' : 'Send'}
            </button>
          </div>
          <p style={{ fontSize: '11px', opacity: 0.35, marginTop: '6px' }}>
            Powered by {import.meta.env.VITE_AI_MODEL_DISPLAY ?? 'Google Gemini'} via OpenRouter
          </p>
        </div>
      </div>
    </AppShell>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  if (message.isLoading) {
    return (
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <AiAvatar />
        <div style={{
          padding: '10px 14px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '10px',
          fontSize: '13px',
          opacity: 0.6,
        }}>
          <LoadingDots />
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          maxWidth: '75%',
          padding: '10px 14px',
          background: 'rgba(99, 102, 241, 0.2)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: '10px 10px 2px 10px',
          fontSize: '14px',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
        }}>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <AiAvatar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          padding: '12px 16px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '2px 10px 10px 10px',
          fontSize: '14px',
          lineHeight: 1.6,
        }}>
          <FormattedText text={message.content} />
        </div>
        {message.charts && message.charts.length > 0 && (
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {message.charts.map((chart, i) => (
              <ChartRenderer key={i} config={chart} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AiAvatar() {
  return (
    <div style={{
      width: '30px',
      height: '30px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #6366f1, #22d3ee)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px',
      fontWeight: 700,
      flexShrink: 0,
      marginTop: '2px',
    }}>
      AI
    </div>
  );
}

function LoadingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'currentColor',
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`@keyframes pulse { 0%,80%,100%{opacity:0.3} 40%{opacity:1} }`}</style>
    </span>
  );
}

// ─── Markdown-lite renderer ────────────────────────────────────────────────────
// Handles: ### ## headings, * - bullet lists, **bold**, *italic*, `code`, newlines

function parseInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} style={{ background: 'rgba(255,255,255,0.12)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.88em', fontFamily: 'monospace' }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function FormattedText({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  function flushList() {
    if (listItems.length === 0) return;
    elements.push(
      <ul key={key++} style={{ paddingLeft: '18px', margin: '4px 0 8px', lineHeight: 1.6 }}>
        {listItems.map((item, i) => <li key={i}>{parseInline(item)}</li>)}
      </ul>,
    );
    listItems = [];
  }

  for (const line of lines) {
    if (line.startsWith('### ')) {
      flushList();
      elements.push(<p key={key++} style={{ fontWeight: 700, fontSize: '14px', margin: '12px 0 4px', opacity: 0.95 }}>{parseInline(line.slice(4))}</p>);
    } else if (line.startsWith('## ')) {
      flushList();
      elements.push(<p key={key++} style={{ fontWeight: 700, fontSize: '15px', margin: '14px 0 4px' }}>{parseInline(line.slice(3))}</p>);
    } else if (line.startsWith('# ')) {
      flushList();
      elements.push(<p key={key++} style={{ fontWeight: 700, fontSize: '16px', margin: '14px 0 6px' }}>{parseInline(line.slice(2))}</p>);
    } else if (/^[*-] /.test(line)) {
      listItems.push(line.slice(2));
    } else if (line === '') {
      flushList();
      elements.push(<br key={key++} />);
    } else {
      flushList();
      elements.push(<span key={key++} style={{ display: 'block' }}>{parseInline(line)}</span>);
    }
  }

  flushList();
  return <>{elements}</>;
}
