import {
  APIOptions,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionStreamResponse,
  Message,
  MessageRole,
  StreamCallbacks,
  AIServiceProvider,
  TextPart,
} from "./types";

// Endpoint
const USE_PROXY = import.meta.env?.VITE_USE_PROXY === 'true';
const OPENROUTER_URL = USE_PROXY
  ? "/api/openrouter"
  : "https://openrouter.ai/api/v1/chat/completions";

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

// Prompt caching helpers
const MAX_CACHE_BREAKPOINTS = 4;

const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

const detectModelFamily = (model: string): 'anthropic' | 'gemini' | 'openai' | 'grok' | 'deepseek' | 'other' => {
  const m = (model || '').toLowerCase();
  if (m.includes('claude') || m.startsWith('anthropic/')) return 'anthropic';
  if (m.includes('gemini') || m.startsWith('google/')) return 'gemini';
  if (m.includes('gpt') || m.startsWith('openai/') || /^o\d/.test(m)) return 'openai';
  if (m.includes('grok') || m.startsWith('x-ai/')) return 'grok';
  if (m.includes('deepseek')) return 'deepseek';
  return 'other';
};

const getCacheTokenThreshold = (model: string): number => {
  const family = detectModelFamily(model);
  switch (family) {
    case 'anthropic':
    case 'gemini':
      // Both Anthropic and Gemini benefit from explicit cache_control; threshold ~4096 tokens
      return 4096;
    default:
      // Other providers (OpenAI, Grok, DeepSeek) use implicit caching; do not add cache_control
      return Number.POSITIVE_INFINITY;
  }
};

const shouldInsertCacheControl = (model: string): boolean => {
  const family = detectModelFamily(model);
  return family === 'anthropic' || family === 'gemini';
};

const transformMessagesForCaching = (messages: Message[], model: string): Message[] => {
  if (!shouldInsertCacheControl(model)) return messages;
  let remaining = MAX_CACHE_BREAKPOINTS;
  const threshold = getCacheTokenThreshold(model);

  return messages.map((m) => {
    if (remaining <= 0) return m;

    if (Array.isArray(m.content)) {
      // If content is multipart, add ephemeral cache_control to the last large text part
      const parts = m.content.map((p) => ({ ...p }));
      for (let i = parts.length - 1; i >= 0; i--) {
        const part = parts[i] as TextPart;
        if (
          remaining > 0 &&
          part.type === "text" &&
          typeof part.text === "string" &&
          estimateTokens(part.text) >= threshold
        ) {
          part.cache_control = { type: "ephemeral" };
          remaining--;
          break; // at most 1 breakpoint per message
        }
      }
      return { ...m, content: parts };
    }

    if (typeof m.content === "string") {
      if (remaining > 0 && estimateTokens(m.content) >= threshold) {
        // Convert to multipart to attach cache_control for large strings
        const parts: TextPart[] = [
          { type: "text", text: m.content, cache_control: { type: "ephemeral" } },
        ];
        remaining--;
        return { ...m, content: parts } as Message;
      }
    }

    return m;
  });
};

const prepareApiKey = (apiKey: string): string => {
  // When using proxy, API key is handled server-side
  if (USE_PROXY) {
    console.log('Proxy mode enabled - API key handled server-side');
    return "";
  }
  
  if (!apiKey) throw new Error("API Key is required when not using proxy mode");
  const cleanKey = apiKey.trim();
  if (cleanKey.toLowerCase().startsWith("bearer ")) return cleanKey.slice(7);
  return cleanKey;
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const prepareRequestLog = (url: string, body: ChatCompletionRequest) =>
  JSON.stringify({ url, method: "POST", body: { ...body, messages: body.messages.map(m => ({ role: m.role, content: typeof m.content === 'string' ? (m.content as string).slice(0, 50) : '[complex]' })) } }, null, 2);

const handleApiError = async (response: Response): Promise<never> => {
  const txt = await response.text().catch(() => "");
  let msg = `Error: ${response.status} ${response.statusText}`;
  try {
    const data = JSON.parse(txt);
    msg = data?.error?.message || msg;
  } catch {
    void 0; // ignore JSON parse errors; fall back to status text
  }
  if (response.status === 401) throw new Error("Authentication failed: Invalid API key.");
  if (response.status === 429) throw new Error("Rate limit exceeded. Please try again later.");
  throw new Error(msg);
};

// Helper function to get model-specific max_tokens. Shared by both send and stream flows.
const getModelMaxTokens = (model: string, defaultMaxTokens: number = 8192): number => {
  const MODEL_CONFIGS: Record<string, { max_tokens: number; context_window: number }> = {
    "z-ai/glm-4.5v": {
      max_tokens: 16000,
      context_window: 64000,
    },
    "z-ai/glm-4.5": {
      max_tokens: 8192,
      context_window: 64000,
    },
    "z-ai/glm-4.5-air:free": {
      max_tokens: 8192,
      context_window: 64000,
    },
  };
  return MODEL_CONFIGS[model]?.max_tokens || defaultMaxTokens;
};

export const openRouterProvider: AIServiceProvider = {
  async sendMessage(messages: Message[], apiKey: string, options: APIOptions = {}) {
    const cleanApiKey = prepareApiKey(apiKey);
    let retries = 0; let lastError: unknown = null;
    while (retries <= MAX_RETRIES) {
      try {
        const modelToUse = options.model || "x-ai/grok-4";
        const cachedMessages: Message[] = transformMessagesForCaching(messages, modelToUse);
        const requestBody: ChatCompletionRequest = {
          model: modelToUse,
          messages: cachedMessages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? getModelMaxTokens(modelToUse),
          usage: { include: true },
          ...(options.plugins && { plugins: options.plugins }),
        };

        console.log("OpenRouter send (attempt " + (retries + 1) + "):", prepareRequestLog(OPENROUTER_URL, requestBody));

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "HTTP-Referer": (typeof window !== 'undefined' ? window.location.origin : '') || "",
          "X-Title": "LampsGPT",
        };
        if (!USE_PROXY) {
          headers["Authorization"] = `Bearer ${cleanApiKey}`;
        }

        const res = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody)
        });
        if (!res.ok) await handleApiError(res);
        const data: ChatCompletionResponse = await res.json();
        return data.choices[0].message.content;
      } catch (err) {
        lastError = err; retries++; if (retries > MAX_RETRIES) break; await delay(RETRY_DELAY * retries);
      }
    }
    throw new Error(`Failed to get response from OpenRouter API: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`);
  },

  async streamResponse(messages: Message[], apiKey: string, callbacks: StreamCallbacks, options: APIOptions = {}) {
    const cleanApiKey = prepareApiKey(apiKey);
    const { onChunk, onComplete, onError, onReasoningChunk, onController, onUsage } = callbacks;
    let retries = 0; let aborted = false;
    while (retries <= MAX_RETRIES && !aborted) {
      try {
        const modelToUse = options.model || "x-ai/grok-4";
        const cachedMessages: Message[] = transformMessagesForCaching(messages, modelToUse);
        const requestBody: ChatCompletionRequest = {
          model: modelToUse,
          messages: cachedMessages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? getModelMaxTokens(modelToUse),
          stream: true,
          usage: { include: true },
          ...(options.plugins && { plugins: options.plugins }),
        };

        console.log("OpenRouter stream (attempt " + (retries + 1) + "):", prepareRequestLog(OPENROUTER_URL, requestBody));

        const controller = new AbortController();
        // Expose controller so UI can cancel the stream
        try { onController?.(controller); } catch {}
        // Inactivity-based timeout that resets on any incoming line/comment
        const inactivityTimeoutMs = 45000;
        let inactivityTimer: number | undefined;
        const resetInactivity = () => {
          if (inactivityTimer !== undefined) clearTimeout(inactivityTimer);
          inactivityTimer = setTimeout(() => {
            aborted = true;
            try { controller.abort(); } catch {}
            onError(new Error("Stream stalled (no data for 45s)"));
          }, inactivityTimeoutMs) as unknown as number;
        };
        resetInactivity();

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
          "HTTP-Referer": (typeof window !== 'undefined' ? window.location.origin : '') || "",
          "X-Title": "LampsGPT",
        };
        if (!USE_PROXY) {
          headers["Authorization"] = `Bearer ${cleanApiKey}`;
        }

        const res = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        if (inactivityTimer !== undefined) clearTimeout(inactivityTimer);
        if (aborted) return;
        if (!res.ok) await handleApiError(res);
        if (!res.body) throw new Error("Response body is null");

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = '';
        let done = false;
        let receivedDone = false;
        let finalUsage: ChatCompletionResponse["usage"] | undefined;
        // Accumulate multi-line data: fields per SSE spec until blank line
        let eventDataParts: string[] = [];

        try {
          while (!done && !aborted) {
            const { value, done: d } = await reader.read();
            done = d;
            if (!value) continue;

            buffer += decoder.decode(value, { stream: true });

            // Process complete lines, keep remainder in buffer
            let start = 0;
            for (;;) {
              const nl = buffer.indexOf('\n', start);
              if (nl === -1) {
                buffer = buffer.slice(start);
                break;
              }
              let line = buffer.slice(start, nl);
              start = nl + 1;

              // Normalize CRLF -> LF by trimming trailing \r
              if (line.endsWith('\r')) line = line.slice(0, -1);

              // Blank line dispatches accumulated event
              if (line === '') {
                if (eventDataParts.length) {
                  const dataStr = eventDataParts.join('\n');
                  eventDataParts = [];
                  if (dataStr === '[DONE]') {
                    receivedDone = true;
                    done = true;
                    // Stop processing further; break out to finalize below
                    break;
                  }
                  try {
                    const parsed: ChatCompletionStreamResponse = JSON.parse(dataStr);
                    const chunk = parsed.choices?.[0]?.delta?.content;
                    const reasoningChunk = (parsed as any)?.choices?.[0]?.delta?.reasoning;
                    if (reasoningChunk && onReasoningChunk) onReasoningChunk(String(reasoningChunk));
                    if (chunk) onChunk(chunk);
                    if (parsed.usage) {
                      finalUsage = parsed.usage;
                    }
                  } catch {
                    // ignore parse errors (e.g., keepalive comments not in JSON)
                  }
                }
                resetInactivity();
                continue;
              }

              // Comment keepalive line like ": OPENROUTER PROCESSING"
              if (line.startsWith(':')) {
                resetInactivity();
                continue;
              }

              // Data line; allow either "data:" or "data: " forms
              if (line.startsWith('data:')) {
                resetInactivity();
                const v = line.startsWith('data: ') ? line.slice(6) : line.slice(5);
                eventDataParts.push(v);
                continue;
              }

              // Ignore other SSE fields (event, id, retry)
            }
          }
        } finally {
          try { reader.releaseLock(); } catch {}
          try { controller.abort(); } catch {}
          if (inactivityTimer !== undefined) clearTimeout(inactivityTimer);
        }
        if (finalUsage && onUsage) {
          try { onUsage(finalUsage); } catch {}
        }
        onComplete();
        return;
      } catch (err) {
        if (aborted) return; if (retries >= MAX_RETRIES) { onError(err as Error); return; }
        retries++; await delay(RETRY_DELAY * retries);
      }
    }
  },

  async callAI(opts) {
    const messages: Message[] = [];
    if (opts.projectInstructions) {
      messages.push({ role: 'system', content: opts.projectInstructions as string });
    }
    messages.push(...opts.messages.map(m => ({ role: m.role as MessageRole, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) })));
    const apiKey = USE_PROXY ? '' : (localStorage.getItem('apiKey') || '');
    if (!USE_PROXY && !apiKey) throw new Error("API Key is required. Please set your API key in settings.");
    const content = await this.sendMessage(messages, apiKey, { max_tokens: opts.max_tokens, temperature: opts.temperature, model: opts.model });
    return { choices: [{ message: { content } }], quick_replies: [] };
  }
};
