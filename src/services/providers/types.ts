// Common types for AI provider services

export type MessageRole = "system" | "user" | "assistant";

export interface CacheControl {
  type: "ephemeral";
}

export interface TextPart {
  type: "text";
  text: string;
  cache_control?: CacheControl;
}

export interface ImagePart {
  type: "image_url";
  image_url: {
    url: string;
    detail: "high" | "low" | "auto";
  };
}

export interface VideoPart {
  type: "video_url";
  video_url: {
    url: string;
    detail: "high" | "low" | "auto";
  };
}

export interface AudioPart {
  type: "audio_url";
  audio_url: {
    url: string;
    detail: "high" | "low" | "auto";
  };
}

export interface FilePart {
  type: "file";
  file: {
    filename: string;
    file_data: string; // URL or data URL (base64)
  };
}

export type MessageContent = string | Array<TextPart | ImagePart | VideoPart | AudioPart | FilePart>;

export interface Message {
  role: MessageRole;
  content: MessageContent;
}

export type Plugin =
  | {
      id: "web";
      max_results?: number;
      search_prompt?: string;
    }
  | {
      id: "file-parser";
      pdf?: {
        engine?: "pdf-text" | "mistral-ocr" | "native";
      };
    };

export interface APIOptions {
  temperature?: number;
  max_tokens?: number;
  model?: string;
  plugins?: Plugin[];
}

export interface ChatCompletionRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  usage?: { include: boolean };
  plugins?: Plugin[];
}

export interface ChatCompletionResponse {
  id: string;
  choices: {
    index: number;
    message: {
      role: "assistant";
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cache_read_tokens?: number;
    cache_write_tokens?: number;
    [key: string]: unknown;
  };
  cache_discount?: number;
}

export interface ChatCompletionStreamResponse {
  id: string;
  choices: {
    index: number;
    delta: {
      content?: string;
      role?: string;
    };
    finish_reason: string | null;
  }[];
}

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onReasoningChunk?: (chunk: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
  onController?: (controller: AbortController) => void;
}

export interface AIServiceProvider {
  sendMessage: (messages: Message[], apiKey: string, options?: APIOptions) => Promise<string>;
  streamResponse: (
    messages: Message[],
    apiKey: string,
    callbacks: StreamCallbacks,
    options?: APIOptions
  ) => Promise<void>;
  callAI: (options: {
    messages: { role: string; content: string }[];
    max_tokens?: number;
    temperature?: number;
    projectInstructions?: string;
    model?: string;
  }) => Promise<{
    choices: [{ message: { content: string } }];
    quick_replies?: string[];
  }>;
}
