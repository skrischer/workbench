// src/memory/session-summarizer.ts — Session Summarizer with LLM Integration

import type { MemoryEntry } from '../types/memory.js';
import type { Message, SessionSummaryInput, SessionSummary, TokenUsage } from '../types/index.js';
import type { RunMetadata, RunLogStatus } from '../types/run.js';
import { SUMMARY_PROMPT, createSessionPrompt } from './summary-prompt.js';
import { validateMemoryEntry } from './validation.js';
import type { TypedEventBus } from '../events/event-bus.js';
import { AnthropicClient } from '../llm/anthropic-client.js';
import { TokenRefresher } from '../llm/token-refresh.js';
import { TokenStorage } from '../llm/token-storage.js';

/** LLM callback function type for dependency injection */
export type LLMCallback = (systemPrompt: string, userPrompt: string) => Promise<string>;

/** Configuration for SessionSummarizer */
export interface SummarizerConfig {
  /** Minimum number of messages required for summarization */
  minMessages?: number;
  /** Maximum number of tags to extract */
  maxTags?: number;
  /** Optional event bus for emitting events */
  eventBus?: TypedEventBus;
}

/**
 * SessionSummarizer generates structured summaries from agent session messages.
 * Uses an injected LLM callback for generation, making it testable and LLM-agnostic.
 */
export class SessionSummarizer {
  private readonly generateSummary: LLMCallback;
  private readonly config: Required<Omit<SummarizerConfig, 'eventBus'>>;
  private readonly eventBus?: TypedEventBus;

  constructor(generateSummary: LLMCallback, config: SummarizerConfig = {}) {
    this.generateSummary = generateSummary;
    this.config = {
      minMessages: config.minMessages ?? 3,
      maxTags: config.maxTags ?? 10,
    };
    this.eventBus = config.eventBus;
  }

  /**
   * Summarizes a session and returns a MemoryEntry.
   * @param messages - Session messages to summarize
   * @param sessionId - ID of the session
   * @returns MemoryEntry containing the summary
   * @throws Error if messages are invalid or empty
   */
  async summarize(messages: Message[], sessionId: string): Promise<MemoryEntry | null> {
    // Skip short sessions
    if (messages.length < this.config.minMessages) {
      return null;
    }

    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('Invalid sessionId');
    }

    const now = new Date().toISOString();
    let summaryContent: string;
    let tags: string[];

    try {
      // Generate summary via LLM
      const userPrompt = createSessionPrompt(messages);
      summaryContent = await this.generateSummary(SUMMARY_PROMPT, userPrompt);
      
      // Extract tags from summary
      tags = this.extractTags(summaryContent);
    } catch (error) {
      // Fallback: generate summary from metadata
      summaryContent = this.generateFallbackSummary(messages);
      tags = this.extractTagsFromMessages(messages);
    }

    // Create MemoryEntry
    const entry: MemoryEntry = {
      id: `session-${sessionId}-${Date.now()}`,
      type: 'session',
      content: summaryContent,
      tags,
      source: {
        type: 'session',
        sessionId,
      },
      createdAt: now,
      updatedAt: now,
      metadata: {
        messageCount: messages.length,
        sessionId,
      },
    };

    // Validate before returning
    validateMemoryEntry(entry);

    // Emit event if event bus is available
    this.eventBus?.emit('memory:summarized', {
      sessionId,
      summaryId: entry.id,
      messageCount: messages.length,
    });

    return entry;
  }

  /**
   * Generates a fallback summary when LLM fails.
   * Extracts basic information from message metadata.
   */
  private generateFallbackSummary(messages: Message[]): string {
    const messageCount = messages.length;
    const roles = new Set(messages.map((m) => m.role));
    const toolMessages = messages.filter((m) => m.role === 'tool');
    
    // Extract tool names from tool messages (simple heuristic)
    const toolNames = new Set<string>();
    toolMessages.forEach((msg) => {
      // Try to extract tool name from content (e.g., "Tool: read_file")
      const match = msg.content.match(/Tool:\s*(\w+)/i);
      if (match) {
        toolNames.add(match[1]);
      }
    });

    let summary = `Session with ${messageCount} messages`;
    
    if (roles.size > 0) {
      summary += ` involving ${Array.from(roles).join(', ')}`;
    }
    
    if (toolNames.size > 0) {
      summary += `. Tools used: ${Array.from(toolNames).join(', ')}`;
    }
    
    summary += '.';
    
    return summary;
  }

  /**
   * Extracts tags from summary text using keyword extraction.
   * Simple implementation that looks for important words.
   */
  private extractTags(summaryText: string): string[] {
    // Common stop words to ignore
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
      'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    ]);

    // Extract words (lowercase, 3+ chars)
    const words = summaryText
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 3 && !stopWords.has(word));

    // Count word frequency
    const frequency = new Map<string, number>();
    words.forEach((word) => {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    });

    // Sort by frequency and take top N
    const tags = Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.maxTags)
      .map(([word]) => word);

    return tags;
  }

  /**
   * Extracts tags from message metadata (fallback method).
   */
  private extractTagsFromMessages(messages: Message[]): string[] {
    const tags = new Set<string>();
    
    // Add role types as tags
    messages.forEach((msg) => {
      tags.add(msg.role);
    });

    // Add 'session' as a base tag
    tags.add('session');
    
    return Array.from(tags).slice(0, this.config.maxTags);
  }
}

/**
 * Maximum number of messages to include in summarization (performance limit)
 */
const MAX_MESSAGES_FOR_SUMMARY = 50;

/**
 * System prompt for structured session summarization
 */
const STRUCTURED_SUMMARY_PROMPT = `You are analyzing an agent session to extract key information.

Your task is to provide a structured summary with the following sections:
1. **summary**: A brief overview of what was accomplished in this session
2. **keyDecisions**: Important choices or decisions that were made
3. **errors**: Problems encountered and how they were resolved
4. **learnings**: Important insights or knowledge gained

Extract factual information from the session. Be concise and specific.`;

/**
 * Interface for LLM response structure
 */
interface LLMSummaryResponse {
  summary: string;
  keyDecisions: string[];
  errors: string[];
  learnings: string[];
}

/**
 * Summarizes an agent session using LLM-based analysis.
 * 
 * Extracts key decisions, errors, and learnings from the session message history.
 * Uses claude-haiku-4 for cost-efficient summarization with structured JSON output.
 * 
 * @param input - Session data including messages, metadata, and file changes
 * @returns Structured session summary with extracted insights
 * @throws Error if input validation fails
 */
export async function summarizeSession(input: SessionSummaryInput): Promise<SessionSummary> {
  // Validate input
  if (!input.sessionId || typeof input.sessionId !== 'string') {
    throw new Error('Invalid sessionId: must be a non-empty string');
  }
  if (!input.runId || typeof input.runId !== 'string') {
    throw new Error('Invalid runId: must be a non-empty string');
  }
  if (!Array.isArray(input.messages)) {
    throw new Error('Invalid messages: must be an array');
  }
  if (!input.runMetadata || typeof input.runMetadata !== 'object') {
    throw new Error('Invalid runMetadata: must be an object');
  }

  const { sessionId, runId, messages, runMetadata, filesModified } = input;

  // Limit message count for performance
  const messagesToSummarize = messages.slice(-MAX_MESSAGES_FOR_SUMMARY);

  // Calculate duration
  const startedAt = new Date(runMetadata.startedAt).getTime();
  const endedAt = runMetadata.endedAt ? new Date(runMetadata.endedAt).getTime() : Date.now();
  const duration = endedAt - startedAt;

  // Convert RunLogStatus to RunStatus
  const statusMap: Record<RunLogStatus, 'pending' | 'running' | 'completed' | 'failed'> = {
    'running': 'running',
    'completed': 'completed',
    'failed': 'failed',
    'cancelled': 'failed'
  };
  const status = statusMap[runMetadata.status];

  try {
    // Initialize LLM client with claude-haiku-4
    const tokenStorage = new TokenStorage();
    const tokenRefresher = new TokenRefresher(tokenStorage);
    const client = new AnthropicClient(tokenRefresher, {
      model: 'claude-haiku-4',
      maxTokens: 2048
    });

    // Build user prompt with session context
    const filesContext = filesModified.length > 0 
      ? `Files Modified: ${filesModified.join(', ')}`
      : 'No files were modified.';

    const messageHistory = messagesToSummarize
      .map((msg, idx) => {
        const timestamp = new Date(msg.timestamp).toISOString();
        return `[${idx + 1}] ${timestamp} - ${msg.role}:\n${msg.content}`;
      })
      .join('\n\n');

    const userPrompt = `Session Context:
- Run ID: ${runId}
- Status: ${runMetadata.status}
- Duration: ${Math.round(duration / 1000)}s
- ${filesContext}

Message History (last ${messagesToSummarize.length} messages):
${messageHistory}

Extract and summarize:
1. **Key Decisions:** What important choices were made?
2. **Errors Encountered:** What went wrong and how was it fixed?
3. **Learnings:** What should be remembered for future sessions?
4. **Overall Summary:** Brief overview of what was accomplished.

Format your response as structured JSON:
{
  "summary": "...",
  "keyDecisions": ["...", "..."],
  "errors": ["...", "..."],
  "learnings": ["...", "..."]
}`;

    // Call LLM API
    const response = await client.sendMessage(
      [
        {
          role: 'user',
          content: userPrompt
        }
      ],
      undefined, // no tools
      { system: STRUCTURED_SUMMARY_PROMPT }
    );

    // Extract text content from response
    const textBlocks = response.content.filter(block => block.type === 'text');
    const responseText = textBlocks.map(block => 'text' in block ? block.text : '').join('');

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in LLM response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as LLMSummaryResponse;

    // Build SessionSummary
    const summary: SessionSummary = {
      sessionId,
      runId,
      summary: parsed.summary || 'No summary available.',
      keyDecisions: Array.isArray(parsed.keyDecisions) ? parsed.keyDecisions : [],
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
      learnings: Array.isArray(parsed.learnings) ? parsed.learnings : [],
      relatedFiles: filesModified,
      metadata: {
        tokenUsage: runMetadata.tokenUsage || {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0
        },
        status,
        duration,
        timestamp: new Date().toISOString()
      }
    };

    return summary;

  } catch (error) {
    // Fallback: Generate basic summary from metadata
    console.warn(`LLM summarization failed, using fallback: ${error}`);

    const fallbackSummary = generateFallbackSummary(messagesToSummarize, filesModified);

    const summary: SessionSummary = {
      sessionId,
      runId,
      summary: fallbackSummary,
      keyDecisions: [],
      errors: [],
      learnings: [],
      relatedFiles: filesModified,
      metadata: {
        tokenUsage: runMetadata.tokenUsage || {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0
        },
        status,
        duration,
        timestamp: new Date().toISOString()
      }
    };

    return summary;
  }
}

/**
 * Generates a basic fallback summary when LLM is unavailable.
 * 
 * @param messages - Message history
 * @param filesModified - List of modified files
 * @returns Basic text summary
 */
function generateFallbackSummary(messages: Message[], filesModified: string[]): string {
  const messageCount = messages.length;
  const roles = new Set(messages.map(m => m.role));
  const toolMessages = messages.filter(m => m.role === 'tool');
  
  // Extract first user message as context
  const firstUserMessage = messages.find(m => m.role === 'user');
  const userContext = firstUserMessage 
    ? firstUserMessage.content.substring(0, 100) + (firstUserMessage.content.length > 100 ? '...' : '')
    : 'No user input';

  // Extract tool names from assistant messages with tool_use blocks
  const toolNames = new Set<string>();
  const assistantMessages = messages.filter(m => m.role === 'assistant');
  assistantMessages.forEach(msg => {
    if (msg.toolUses && Array.isArray(msg.toolUses)) {
      msg.toolUses.forEach(toolUse => {
        toolNames.add(toolUse.name);
      });
    }
  });

  // Extract error messages (case-insensitive regex for Error:, Failed:, Exception)
  const errorPattern = /\b(error|failed|exception)[:\s]/i;
  const errorMessages: string[] = [];
  messages.forEach(msg => {
    const content = typeof msg.content === 'string' ? msg.content : '';
    if (errorPattern.test(content)) {
      // Extract first line containing error keyword
      const lines = content.split('\n');
      const errorLine = lines.find(line => errorPattern.test(line));
      if (errorLine) {
        errorMessages.push(errorLine.substring(0, 80).trim());
      }
    }
  });

  // Detect success indicators (case-insensitive)
  const successPattern = /\b(done|success|completed|finished|resolved)\b/i;
  const hasSuccessIndicator = messages.some(msg => {
    const content = typeof msg.content === 'string' ? msg.content : '';
    return successPattern.test(content);
  });

  // Build summary
  let summary = `Session with ${messageCount} messages involving ${Array.from(roles).join(', ')}. `;
  
  if (toolMessages.length > 0) {
    summary += `${toolMessages.length} tool calls were made`;
    if (toolNames.size > 0) {
      summary += ` (${Array.from(toolNames).slice(0, 5).join(', ')}${toolNames.size > 5 ? '...' : ''})`;
    }
    summary += '. ';
  }
  
  if (filesModified.length > 0) {
    summary += `Modified files: ${filesModified.slice(0, 5).join(', ')}${filesModified.length > 5 ? '...' : ''}. `;
  }

  if (errorMessages.length > 0) {
    summary += `Errors encountered: ${errorMessages[0]}${errorMessages.length > 1 ? ` (+${errorMessages.length - 1} more)` : ''}. `;
  }

  if (hasSuccessIndicator) {
    summary += `Task completed successfully. `;
  }
  
  summary += `Context: ${userContext}`;
  
  return summary;
}
