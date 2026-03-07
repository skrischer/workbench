// src/memory/session-summarizer.ts — Session Summarizer with LLM Integration

import type { MemoryEntry } from '../types/memory.js';
import type { Message } from '../types/index.js';
import { SUMMARY_PROMPT, createSessionPrompt } from './summary-prompt.js';
import { validateMemoryEntry } from './validation.js';

/** LLM callback function type for dependency injection */
export type LLMCallback = (systemPrompt: string, userPrompt: string) => Promise<string>;

/** Configuration for SessionSummarizer */
export interface SummarizerConfig {
  /** Minimum number of messages required for summarization */
  minMessages?: number;
  /** Maximum number of tags to extract */
  maxTags?: number;
}

/**
 * SessionSummarizer generates structured summaries from agent session messages.
 * Uses an injected LLM callback for generation, making it testable and LLM-agnostic.
 */
export class SessionSummarizer {
  private readonly generateSummary: LLMCallback;
  private readonly config: Required<SummarizerConfig>;

  constructor(generateSummary: LLMCallback, config: SummarizerConfig = {}) {
    this.generateSummary = generateSummary;
    this.config = {
      minMessages: config.minMessages ?? 3,
      maxTags: config.maxTags ?? 10,
    };
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
