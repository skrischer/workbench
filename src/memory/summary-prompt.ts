// src/memory/summary-prompt.ts — System Prompt Template for Session Summary Generation

/**
 * System prompt template for generating session summaries.
 * Instructs the LLM to create structured summaries from session messages.
 */
export const SUMMARY_PROMPT = `You are a session summarizer. Your task is to analyze a conversation session and create a concise, structured summary.

The summary should include:
1. **What was done**: Main actions, tasks completed, or decisions made
2. **Tools used**: Which tools/functions were called during the session
3. **Key insights**: Important learnings, decisions, or context discovered
4. **Outcome**: What was the final result or state

Format your response as a clear, structured summary in 2-4 paragraphs. Focus on factual information and actionable insights.

Be concise but comprehensive. Avoid unnecessary pleasantries or meta-commentary.`;

/**
 * Creates a user prompt from session messages.
 * @param messages - Array of session messages
 * @returns Formatted prompt string
 */
export function createSessionPrompt(messages: Array<{ role: string; content: string; timestamp: string }>): string {
  const messageList = messages
    .map((msg, idx) => {
      const timestamp = new Date(msg.timestamp).toISOString();
      return `[${idx + 1}] ${timestamp} - ${msg.role}:\n${msg.content}`;
    })
    .join('\n\n');

  return `Please summarize the following session:\n\n${messageList}\n\nProvide a structured summary following the guidelines above.`;
}
