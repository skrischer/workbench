// Test utilities and mock helpers for Workbench

import type { ToolResult, Message } from '../types/index.js';

/**
 * Create a mock ToolResult for testing
 */
export function createMockToolResult(
  overrides?: Partial<ToolResult>
): ToolResult {
  return {
    success: true,
    output: 'Mock tool output',
    ...overrides,
  };
}

/**
 * Create a mock Message for testing
 */
export function createMockMessage(overrides?: Partial<Message>): Message {
  return {
    role: 'user',
    content: 'Mock message content',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock error ToolResult
 */
export function createMockToolError(errorMessage: string): ToolResult {
  return {
    success: false,
    output: '',
    error: errorMessage,
  };
}

/**
 * Create a mock assistant Message
 */
export function createMockAssistantMessage(content: string): Message {
  return {
    role: 'assistant',
    content,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a mock tool Message
 */
export function createMockToolMessage(
  content: string,
  toolCallId: string
): Message {
  return {
    role: 'tool',
    content,
    toolCallId,
    timestamp: new Date().toISOString(),
  };
}
