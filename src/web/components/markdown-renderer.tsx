// src/web/components/markdown-renderer.tsx — Markdown rendering with syntax highlighting
import { useState, useCallback, type ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism/index.js';
import { Copy, Check } from 'lucide-react';
import { cn } from '../lib/utils.js';

// === Copy Button ===

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md text-foreground-muted hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
      aria-label={copied ? 'Copied' : 'Copy code'}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

// === Streaming Cursor ===

export function StreamingCursor() {
  return (
    <span
      className="inline-block w-[8px] h-[1.1em] bg-foreground ml-0.5 align-middle animate-cursor-blink"
      aria-hidden="true"
    />
  );
}

// === Markdown Renderer ===

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

export function MarkdownRenderer({
  content,
  isStreaming,
  className,
}: MarkdownRendererProps) {
  return (
    <div className={cn('markdown-content font-sans text-sm leading-relaxed', className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Code blocks
          code({ className: codeClassName, children, ...props }) {
            const match = /language-(\w+)/.exec(codeClassName ?? '');
            const codeString = String(children).replace(/\n$/, '');

            if (match) {
              return (
                <div className="group relative my-3 rounded-md overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-muted text-foreground-muted text-xs font-mono">
                    <span>{match[1]}</span>
                  </div>
                  <CopyButton text={codeString} />
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      borderRadius: 0,
                      background: 'var(--color-code-background)',
                      fontSize: '14px',
                    }}
                    codeTagProps={{
                      style: { fontFamily: 'var(--font-mono)' },
                    }}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                </div>
              );
            }

            // Inline code
            return (
              <code
                className="bg-muted px-1.5 py-0.5 rounded-sm font-mono text-[13px]"
                {...props}
              >
                {children}
              </code>
            );
          },

          // Pre — passthrough (code block handles rendering)
          pre({ children }) {
            return <>{children}</>;
          },

          // Links
          a({ href, children, ...props }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
                {...props}
              >
                {children}
              </a>
            );
          },

          // Tables
          table({ children, ...props }) {
            return (
              <div className="my-3 overflow-x-auto">
                <table
                  className="w-full border-collapse text-sm"
                  {...props}
                >
                  {children}
                </table>
              </div>
            );
          },

          thead({ children, ...props }) {
            return (
              <thead className="bg-muted" {...props}>
                {children}
              </thead>
            );
          },

          th({ children, ...props }) {
            return (
              <th
                className="border border-border-subtle px-3 py-1.5 text-left font-semibold text-foreground-secondary text-xs"
                {...props}
              >
                {children}
              </th>
            );
          },

          td({ children, ...props }) {
            return (
              <td
                className="border border-border-subtle px-3 py-1.5"
                {...props}
              >
                {children}
              </td>
            );
          },

          // Paragraphs
          p({ children }) {
            return <p className="mb-2 last:mb-0">{children as ReactNode}</p>;
          },

          // Lists
          ul({ children, ...props }) {
            return (
              <ul className="list-disc pl-5 mb-2 space-y-1" {...props}>
                {children}
              </ul>
            );
          },

          ol({ children, ...props }) {
            return (
              <ol className="list-decimal pl-5 mb-2 space-y-1" {...props}>
                {children}
              </ol>
            );
          },

          // Headings
          h1({ children, ...props }) {
            return (
              <h1 className="text-lg font-semibold font-mono mb-2 mt-4 first:mt-0" {...props}>
                {children}
              </h1>
            );
          },

          h2({ children, ...props }) {
            return (
              <h2 className="text-base font-semibold font-mono mb-2 mt-3 first:mt-0" {...props}>
                {children}
              </h2>
            );
          },

          h3({ children, ...props }) {
            return (
              <h3 className="text-sm font-semibold font-mono mb-1.5 mt-3 first:mt-0" {...props}>
                {children}
              </h3>
            );
          },

          // Blockquote
          blockquote({ children, ...props }) {
            return (
              <blockquote
                className="border-l-2 border-primary pl-3 my-2 text-foreground-secondary italic"
                {...props}
              >
                {children}
              </blockquote>
            );
          },

          // Horizontal rule
          hr() {
            return <hr className="border-border-subtle my-4" />;
          },

          // Images
          img({ src, alt, ...props }) {
            return (
              <img
                src={src}
                alt={alt}
                className="max-w-full rounded-md my-2"
                {...props}
              />
            );
          },

          // Task list items (GFM)
          input({ checked, ...props }) {
            return (
              <input
                type="checkbox"
                checked={checked}
                readOnly
                className="mr-1.5 accent-primary"
                {...props}
              />
            );
          },

          // Strikethrough
          del({ children, ...props }) {
            return (
              <del className="text-foreground-muted" {...props}>
                {children}
              </del>
            );
          },
        }}
      >
        {content}
      </Markdown>
      {isStreaming && <StreamingCursor />}
    </div>
  );
}
