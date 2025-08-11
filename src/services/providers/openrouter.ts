import {
  APIOptions,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionStreamResponse,
  Message,
  StreamCallbacks,
  AIServiceProvider,
  TextPart,
} from "./types";

// Endpoint
const USE_PROXY = (import.meta as any).env?.VITE_USE_PROXY === 'true';
const OPENROUTER_URL = USE_PROXY
  ? "/api/openrouter"
  : "https://openrouter.ai/api/v1/chat/completions";

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

const prepareApiKey = (apiKey: string): string => {
  if (!apiKey && !USE_PROXY) throw new Error("API Key is required");
  const cleanKey = (apiKey || "").trim();
  if (cleanKey.toLowerCase().startsWith("bearer ")) return cleanKey.slice(7);
  return cleanKey;
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const prepareRequestLog = (url: string, body: ChatCompletionRequest) =>
  JSON.stringify({ url, method: "POST", body: { ...body, messages: body.messages.map(m => ({ role: m.role, content: typeof m.content === 'string' ? (m.content as string).slice(0, 50) : '[complex]' })) } }, null, 2);

const handleApiError = async (response: Response): Promise<never> => {
  let txt = await response.text().catch(() => "");
  let msg = `Error: ${response.status} ${response.statusText}`;
  try {
    const data = JSON.parse(txt);
    msg = data?.error?.message || msg;
  } catch {}
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
    let retries = 0; let lastError: any = null;
    while (retries <= MAX_RETRIES) {
      try {
        // Insert cache_control breakpoints for large text bodies in system/user messages
        const cachedMessages: Message[] = messages.map((m) => {
          if (Array.isArray(m.content)) {
            // If content is multipart, add ephemeral cache_control to the last large text part
            const parts = m.content.map((p) => ({ ...p }));
            for (let i = parts.length - 1; i >= 0; i--) {
              const part = parts[i] as TextPart;
              if (part.type === "text" && typeof part.text === "string" && part.text.length > 4000) {
                part.cache_control = { type: "ephemeral" };
                break;
              }
            }
            return { ...m, content: parts };
          }
          if (typeof m.content === "string" && m.content.length > 4000) {
            // Convert to multipart to attach cache_control for large strings
            const parts: TextPart[] = [
              { type: "text", text: m.content, cache_control: { type: "ephemeral" } },
            ];
            return { ...m, content: parts } as Message;
          }
          return m;
        });

        const modelToUse = options.model || "x-ai/grok-4";
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
    const { onChunk, onComplete, onError } = callbacks;
    let retries = 0; let aborted = false;
    while (retries <= MAX_RETRIES && !aborted) {
      try {
        const cachedMessages: Message[] = messages.map((m) => {
          if (Array.isArray(m.content)) {
            const parts = m.content.map((p) => ({ ...p }));
            for (let i = parts.length - 1; i >= 0; i--) {
              const part = parts[i] as TextPart;
              if (part.type === "text" && typeof part.text === "string" && part.text.length > 4000) {
                part.cache_control = { type: "ephemeral" };
                break;
              }
            }
            return { ...m, content: parts };
          }
          if (typeof m.content === "string" && m.content.length > 4000) {
            const parts: TextPart[] = [
              { type: "text", text: m.content, cache_control: { type: "ephemeral" } },
            ];
            return { ...m, content: parts } as Message;
          }
          return m;
        });

        const modelToUse = options.model || "x-ai/grok-4";
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
        const timeoutId = setTimeout(() => { controller.abort(); aborted = true; onError(new Error("Request timed out after 30 seconds")); }, 30000);

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
        clearTimeout(timeoutId);
        if (aborted) return;
        if (!res.ok) await handleApiError(res);
        if (!res.body) throw new Error("Response body is null");

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = '';
        let done = false;

        while (!done && !aborted) {
          const { value, done: d } = await reader.read();
          done = d;
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (!line.trim()) continue;
              if (!line.startsWith('data: ')) continue;
              const data = line.substring(6);
              if (data === '[DONE]') { onComplete(); return; }
              try {
                const parsed: ChatCompletionStreamResponse = JSON.parse(data);
                const chunk = parsed.choices?.[0]?.delta?.content;
                // Some reasoning models return 'reasoning' field in delta
                const reasoningChunk = (parsed as any)?.choices?.[0]?.delta?.reasoning;
                if (reasoningChunk && callbacks.onReasoningChunk) callbacks.onReasoningChunk(reasoningChunk as unknown as string);
                if (chunk) onChunk(chunk);
              } catch {}
            }
          }
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
    messages.push(...opts.messages.map(m => ({ role: m.role as any, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) })));
    const apiKey = USE_PROXY ? '' : (localStorage.getItem('apiKey') || '');
    if (!USE_PROXY && !apiKey) throw new Error("API Key is required. Please set your API key in settings.");
    const content = await this.sendMessage(messages, apiKey, { max_tokens: opts.max_tokens, temperature: opts.temperature, model: opts.model });
    return { choices: [{ message: { content } }], quick_replies: [] };
  }
};


