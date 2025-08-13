import React, { useState, useRef, useEffect, useMemo } from "react";
import { Bot, User, Copy, ThumbsUp, ThumbsDown, Check, Play, RefreshCw, XCircle, Clock, RotateCw, Image, Brain, ChevronDown, ChevronUp, Download, Volume2, Paperclip } from "lucide-react";
import { useChatContext } from '@/contexts/ChatContext';
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Custom hook to get the active bot name
const useCustomBotName = () => {
  const [customBotName, setCustomBotName] = useState<string | null>(null);
  
  useEffect(() => {
    const checkForCustomBot = () => {
      const customBotString = sessionStorage.getItem('activeCustomBot');
      if (customBotString) {
        try {
          const botData = JSON.parse(customBotString);
          setCustomBotName(botData.name);
        } catch (error) {
          console.error('Failed to parse custom bot data:', error);
          setCustomBotName(null);
        }
      } else {
        setCustomBotName(null);
      }
    };
    
    checkForCustomBot();
    
    // Check again when session storage changes
    window.addEventListener('storage', checkForCustomBot);
    return () => {
      window.removeEventListener('storage', checkForCustomBot);
    };
  }, []);
  
  return customBotName;
};

interface ChatMessageProps {
  message: {
    id: string;
    role: "user" | "assistant" | "system";
    content: string | {
      type: "text" | "image_url" | "file";
      text?: string;
      image_url?: {
        url: string;
        detail: "high" | "low" | "auto";
      };
      file?: {
        filename: string;
        file_data: string;
      };
    }[];
    timestamp: Date;
    fileContents?: string; // File contents for file-based messages
    fileNames?: string[]; // File names for file-based messages
    isGeneratingImage?: boolean; // Flag for generating image state
    imagePrompt?: string; // The original image prompt
    reasoning?: string;
    reasoningVisible?: boolean;
  };
  onRegenerate?: () => void;
}

// Define a more generic code component props interface
interface CodeComponentProps {
  node?: any;
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
}

const CodeBlock = ({ language, value }: { language: string, value: string }) => {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewOutput, setPreviewOutput] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [hasError, setHasError] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  
  // Define which languages can be previewed
  const previewableLanguages = ['javascript', 'js', 'typescript', 'ts', 'html', 'svg', 'css'];
  const isPreviewable = previewableLanguages.includes(language.toLowerCase());
  
  // Effect to scroll to bottom of output when new content is added
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [previewOutput]);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const runCode = () => {
    setIsRunning(true);
    setHasError(false);
    setPreviewOutput([]);
    
    const languageType = language.toLowerCase();
    
    // Handle HTML and SVG
    if (['html', 'svg'].includes(languageType)) {
      try {
        // Create a safe preview of HTML content
        setPreviewOutput([`<div class="html-preview">${value}</div>`]);
        setShowPreview(true);
      } catch (error) {
        setHasError(true);
        setPreviewOutput([`Rendering error: ${error instanceof Error ? error.message : String(error)}`]);
      } finally {
        setIsRunning(false);
      }
      return;
    }
    
    // Handle CSS
    if (languageType === 'css') {
      try {
        // Show CSS preview with a sample div
        const sampleHTML = `
          <div class="css-preview">
            <style>${value}</style>
            <div class="sample-element">Sample Element with Applied CSS</div>
            <div class="sample-element-alt">Alternative Element</div>
          </div>
        `;
        setPreviewOutput([sampleHTML]);
        setShowPreview(true);
      } catch (error) {
        setHasError(true);
        setPreviewOutput([`Rendering error: ${error instanceof Error ? error.message : String(error)}`]);
      } finally {
        setIsRunning(false);
      }
      return;
    }
    
    // Handle JavaScript/TypeScript
    if (['javascript', 'js', 'typescript', 'ts'].includes(languageType)) {
      // Create a sandbox to run the code
      const originalConsoleLog = console.log;
      const originalConsoleError = console.error;
      const originalConsoleWarn = console.warn;
      const originalConsoleInfo = console.info;
      
      const output: string[] = [];
      
      // Override console methods to capture output
      console.log = (...args) => {
        output.push(args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '));
      };
      
      console.error = (...args) => {
        output.push(`Error: ${args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ')}`);
      };
      
      console.warn = (...args) => {
        output.push(`Warning: ${args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ')}`);
      };
      
      console.info = (...args) => {
        output.push(`Info: ${args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ')}`);
      };
      
      try {
        // Execute the JavaScript code
        const result = new Function(value)();
        
        // If the code returns a value, add it to output
        if (result !== undefined) {
          output.push(`Return value: ${typeof result === 'object' ? JSON.stringify(result, null, 2) : result}`);
        }
        
        // If no output was generated, show a message
        if (output.length === 0) {
          output.push("Code executed successfully (no output)");
        }
        
        setPreviewOutput(output);
        setShowPreview(true);
      } catch (error) {
        setHasError(true);
        setPreviewOutput([`Execution error: ${error instanceof Error ? error.message : String(error)}`]);
        setShowPreview(true);
      } finally {
        // Restore original console methods
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
        console.warn = originalConsoleWarn;
        console.info = originalConsoleInfo;
        setIsRunning(false);
      }
      return;
    }
    
    // For any other languages we don't yet support
    setPreviewOutput(["Preview not available for this language yet"]);
    setShowPreview(true);
    setIsRunning(false);
  };
  
  return (
    <div className="relative rounded-xl overflow-hidden my-4 border border-gray-200 group bg-white shadow-sm">
      <div className="flex items-center justify-between py-1.5 px-3 bg-gray-50 text-gray-600 text-xs border-b border-gray-200">
        <span className="font-mono">{language}</span>
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {isPreviewable && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="p-1 rounded hover:bg-gray-200/60"
              title={showPreview ? "Hide preview" : "Show preview"}
            >
              <Play size={14} className={showPreview ? "text-green-500" : ""} />
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-gray-200/60"
            title="Copy code"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
        </div>
      </div>
      
      <SyntaxHighlighter
        language={language}
        style={oneLight}
        showLineNumbers={true}
        lineProps={() => ({
          style: { backgroundColor: 'transparent !important' }
        })}
        customStyle={{ 
          margin: 0, 
          background: 'transparent',
          fontSize: '1.15em'
        }}
        codeTagProps={{
          style: {
            backgroundColor: 'transparent !important'
          }
        }}
      >
        {value}
      </SyntaxHighlighter>
      
      {/* Preview section (if enabled) */}
      {showPreview && (
        <div className="border-t border-gray-200 bg-white">
          <div className="flex items-center justify-between py-1.5 px-3 bg-gray-50 text-gray-600 text-xs">
            <span>Output</span>
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                onClick={runCode}
                disabled={isRunning}
                className="p-1 rounded hover:bg-gray-200/60"
                title="Run code again"
              >
                <RefreshCw size={14} className={isRunning ? "animate-spin" : ""} />
              </button>
              <button
                onClick={() => setShowPreview(false)}
                className="p-1 rounded hover:bg-gray-200/60"
                title="Close preview"
              >
                <XCircle size={14} />
              </button>
            </div>
          </div>
          
          <div 
            ref={outputRef}
            className="bg-gray-50 text-gray-800 p-3 font-mono text-sm overflow-auto max-h-[300px]"
          >
            {isRunning ? (
              <div className="text-gray-500">Running code...</div>
            ) : previewOutput.length > 0 ? (
              previewOutput.map((output, i) => (
                <div 
                  key={i} 
                  className={hasError && i === previewOutput.length - 1 ? "text-red-600" : ""}
                  dangerouslySetInnerHTML={{ __html: output }}
                />
              ))
            ) : (
              <div className="text-gray-500">No output</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ChatMessage = ({ message, onRegenerate }: ChatMessageProps) => {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const customBotName = useCustomBotName();
  const { setMessageReasoningVisible } = useChatContext();
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Extract file attachments (e.g., PDFs) from message content or fallback to fileNames
  const attachedFiles = useMemo(() => {
    if (Array.isArray(message.content)) {
      const files = message.content
        .filter((item: any) => item && item.type === 'file' && item.file)
        .map((item: any) => ({
          name: item.file.filename as string,
          url: item.file.file_data as string
        }));
      if (files.length > 0) return files;
    }
    if (message.fileNames && message.fileNames.length > 0) {
      return message.fileNames.map(name => ({ name, url: '' }));
    }
    return [] as { name: string; url: string }[];
  }, [message]);

  // Format timestamp for display
  const formatTimestamp = (timestamp: Date) => {
    if (!(timestamp instanceof Date) && typeof timestamp !== 'string') {
      return '';
    }
    
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    
    // Check if valid date
    if (isNaN(date.getTime())) {
      return '';
    }
    
    // Format: HH:MM AM/PM
    return date.toLocaleTimeString([], { 
      hour: '2-digit',
      minute: '2-digit',
      hour12: true 
    });
  };
  
  const copyToClipboard = () => {
    const textContent = typeof message.content === 'string' 
      ? message.content 
      : message.content
         .filter(item => item.type === 'text')
         .map(item => (item as {type: 'text', text: string}).text)
         .join('\n');
    
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Extract plain text from message
  const getMessageText = () => {
    if (typeof message.content === 'string') return message.content;
    if (Array.isArray(message.content)) {
      return message.content
        .filter(item => item.type === 'text' && item.text)
        .map(item => (item as {type: 'text', text: string}).text)
        .join(' ');
    }
    return '';
  };

  const handleTTS = async () => {
    setTtsLoading(true);
    setTtsError(null);
    try {
      const text = getMessageText();
      if (!text) throw new Error('No text to read');
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }
      const data = await res.json();
      const audioBase64 = data.audio;
      if (!audioBase64) throw new Error('No audio data received');
      const audioBlob = new Blob([
        Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0))
      ], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
      } else {
        const audio = new window.Audio(audioUrl);
        audioRef.current = audio;
        audio.play();
      }
    } catch (e: any) {
      setTtsError(e.message || 'TTS failed');
    } finally {
      setTtsLoading(false);
    }
  };
  
  // Extract any image URLs from message content for convenience
  const imageUrls = React.useMemo(() => {
    if (Array.isArray(message.content)) {
      return message.content
        .filter((item): item is { type: "image_url"; image_url: { url: string; detail: "high" | "low" | "auto" } } =>
          item.type === 'image_url' && !!item.image_url && typeof item.image_url.url === 'string'
        )
        .map(item => item.image_url.url);
    }
    return [] as string[];
  }, [message]);

  const downloadFirstImage = () => {
    if (imageUrls.length === 0) return;
    const url = imageUrls[0];
    try {
      const a = document.createElement('a');
      a.href = url;
      const base = (message.imagePrompt || 'generated-image').toString().slice(0, 40).replace(/[^a-z0-9-_ ]/gi, '').trim() || 'generated-image';
      a.download = `${base}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error('Failed to trigger image download', e);
    }
  };
  
  // Render message content
  const renderContent = () => {
    // Extract content based on type
    let contentToRender = "";
    
    // Handle complex content structure that might include images
    if (typeof message.content === 'string') {
      contentToRender = message.content;
    } else if (Array.isArray(message.content)) {
      // For complex content structure (used in vision model)
      message.content.forEach(item => {
        if (item.type === 'text' && item.text) {
          contentToRender += item.text;
        }
      });
    }
    
    // If message has file contents, render them
    if (message.fileContents) {
      return (
        <div>
          <div className="mb-2">{contentToRender}</div>
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-md overflow-auto max-h-[400px] whitespace-pre-wrap font-mono text-sm">
            {message.fileContents}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Files: {message.fileNames?.join(', ')}
          </div>
        </div>
      );
    }
    
    // Replace any user mentions with styled spans
    const formattedContent = contentToRender.replace(
      /@([a-zA-Z0-9_]+)/g, 
      "<span class='text-blue-500 dark:text-blue-400'>@$1</span>"
    );
    
    return (
      <div className="prose dark:prose-invert prose-sm max-w-none">
        <ReactMarkdown
          components={{
            code: ({node, inline, className, children, ...props}: CodeComponentProps) => {
              const match = /language-(\w+)/.exec(className || '');
              
              if (inline) {
                return (
                  <code className="font-mono p-0.5 rounded text-sm border border-gray-300 dark:border-gray-600" {...props}>
                    {String(children).replace(/\n$/, '')}
                  </code>
                );
              }
              
              const language = match ? match[1] : '';
              const value = String(children).replace(/\n$/, '');
              
              if (value.length > 5) {
                return <CodeBlock language={language || 'text'} value={value} />;
              }
              
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
            // Add styles to links
            a: ({node, ...props}) => (
              <a 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-600 dark:text-blue-400 hover:underline" 
                {...props}
              />
            ),
          }}
        >
          {formattedContent}
        </ReactMarkdown>
        
        {/* Display image generation placeholder */}
        {message.isGeneratingImage && (
          <div className="mt-3">
            <div className="relative w-full h-0 pb-[56.25%] rounded-md overflow-hidden glass-gold gold-gradient">
              {/* animated shimmer sweep */}
              <div className="gold-shimmer" />

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center h-14 w-14 rounded-full bg-gold-soft/40 border border-yellow-400/30 shadow-lg shadow-yellow-500/10">
                    <Image size={28} className="text-yellow-500" />
                  </div>
                  <div className="mt-3 h-3 w-32 rounded-full bg-gold-soft animate-pulse"></div>
                  <div className="mt-2 h-2 w-56 rounded-full bg-gold-soft/70 animate-pulse"></div>
                </div>
                <div className="absolute bottom-4 left-0 right-0 text-center text-sm text-gold">
                  Generating image of {message.imagePrompt ? <strong>{message.imagePrompt}</strong> : ''}...
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Display images if any */}
        {imageUrls.length > 0 && (
          <div className="mt-3 grid grid-cols-1 gap-3">
            {imageUrls.map((url, index) => (
              <div key={`img-${index}`} className="relative">
                <img 
                  src={url} 
                  alt={`Generated image ${index + 1}`} 
                  className="rounded-md w-full object-contain bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700" 
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="w-full py-4 md:py-6 px-4 md:px-6 group">
      <div className={cn(
        "max-w-3xl mx-auto",
        isUser ? "flex justify-end" : "flex items-start space-x-4 md:space-x-6"
      )}>
        {/* For AI messages, show avatar on left */}
        {!isUser && (
          <div className="flex-shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-emerald-500">
              <Bot size={18} className="text-white" />
            </div>
          </div>
        )}
        
        {/* Message content */}
        <div className={cn(
          "min-w-0",
          isUser ? "max-w-[85%]" : "flex-1"
        )}>
          {/* Message header */}
          <div className={cn(
            "flex items-center mb-1 text-sm font-medium",
            isUser && "justify-end" // Right align user message header
          )}>
            {/* For user messages, show avatar inline with name */}
            {isUser && (
              <div className="mr-2 flex h-6 w-6 items-center justify-center rounded-sm bg-gray-300 dark:bg-gray-600">
                <User size={14} className="text-gray-800 dark:text-gray-200" />
              </div>
            )}
            
            <span className="text-gray-900 dark:text-gray-100">
              {isUser ? "You" : (customBotName || "UNCENSORED")}
            </span>
            
            {/* Timestamp display */}
            <div className="ml-2 flex items-center text-xs text-gray-500 dark:text-gray-400">
              <Clock size={12} className="mr-1" />
              <span>{formatTimestamp(message.timestamp)}</span>
            </div>
          </div>

          {/* File content notice */}
          {message.fileContents && (
            <div className="mb-4 p-2 rounded-md bg-gray-100 dark:bg-gray-600/40 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
                {message.fileNames && message.fileNames.length > 0 ? (
                  <span>Files: {message.fileNames.join(', ')}</span>
                ) : (
                  <span>File content attached</span>
                )}
              </div>
            </div>
          )}
          
          {/* Per-message reasoning panel for assistant messages */}
          {!isUser && message.reasoning && (
            <div className="mb-2 rounded-md border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
              <div className="flex items-center justify-between px-2 py-1 text-[11px] text-yellow-800 dark:text-yellow-200">
                <div className="flex items-center gap-1">
                  <Brain size={12} />
                  <span>Thinking</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const isVisible = Boolean(message.reasoningVisible);
                    setMessageReasoningVisible(message.id, !isVisible);
                  }}
                  className="p-1 rounded hover:bg-yellow-100/60 dark:hover:bg-yellow-800/40"
                  aria-label={message.reasoningVisible ? 'Hide thinking' : 'Show thinking'}
                >
                  {message.reasoningVisible ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>
              {message.reasoningVisible && (
                <div className="px-2 pb-2 text-xs whitespace-pre-wrap text-yellow-900 dark:text-yellow-100">
                  {message.reasoning}
                </div>
              )}
            </div>
          )}

          {/* Render message content */}
          {renderContent()}

          {/* Attachment pills (shown under user messages) */}
          {isUser && attachedFiles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 justify-end">
              {attachedFiles.map((file, idx) => {
                const isDownloadable = typeof file.url === 'string' && file.url.length > 0;
                const Pill = (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200">
                    <Paperclip size={12} />
                    <span className="max-w-[180px] truncate" title={file.name}>{file.name}</span>
                  </span>
                );
                return (
                  <div key={`attach-${idx}`}>
                    {isDownloadable ? (
                      <a href={file.url} download={file.name} target="_blank" rel="noopener noreferrer">{Pill}</a>
                    ) : (
                      Pill
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Message actions - only visible on hover */}
          <div className="mt-3 flex items-center gap-2 text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {/* Speaker button for TTS */}
            <button
              onClick={handleTTS}
              className="p-1 hover:text-gray-700 dark:hover:text-gray-200 rounded"
              aria-label="Read message aloud"
              disabled={ttsLoading}
              title={ttsError ? ttsError : ttsLoading ? 'Loading...' : 'Read message aloud'}
            >
              {ttsLoading ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /></svg>
              ) : (
                <Volume2 size={16} />
              )}
            </button>
            <audio ref={audioRef} hidden />
            {/* Copy button */}
            <button 
              onClick={copyToClipboard}
              className="p-1 hover:text-gray-700 dark:hover:text-gray-200 rounded"
              aria-label="Copy to clipboard"
            >
              <Copy size={16} />
              {copied && <span className="ml-1 text-xs">Copied!</span>}
            </button>
            {/* Download image (assistant messages with images only) */}
            {!isUser && imageUrls.length > 0 && (
              <button
                onClick={downloadFirstImage}
                className="p-1 hover:text-gray-700 dark:hover:text-gray-200 rounded"
                aria-label="Download image"
                title="Download image"
              >
                <Download size={16} />
              </button>
            )}
            
            {/* Regenerate button - only for assistant messages */}
            {!isUser && onRegenerate && (
              <button
                onClick={onRegenerate}
                className="p-1 hover:text-gray-700 dark:hover:text-gray-200 rounded"
                aria-label="Regenerate response"
              >
                <RotateCw size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
