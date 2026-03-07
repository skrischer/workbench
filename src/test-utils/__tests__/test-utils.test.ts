import { describe, it, expect } from 'vitest';
import {
  createMockToolResult,
  createMockMessage,
  createMockToolError,
  createMockAssistantMessage,
  createMockToolMessage,
} from '../index.js';

describe('Test Utils', () => {
  describe('createMockToolResult', () => {
    it('should create a successful ToolResult by default', () => {
      const result = createMockToolResult();
      expect(result.success).toBe(true);
      expect(result.output).toBe('Mock tool output');
    });

    it('should allow overriding properties', () => {
      const result = createMockToolResult({
        success: false,
        output: 'Custom output',
        error: 'Something went wrong',
      });
      expect(result.success).toBe(false);
      expect(result.output).toBe('Custom output');
      expect(result.error).toBe('Something went wrong');
    });
  });

  describe('createMockMessage', () => {
    it('should create a user message by default', () => {
      const message = createMockMessage();
      expect(message.role).toBe('user');
      expect(message.content).toBe('Mock message content');
      expect(message.timestamp).toBeDefined();
    });

    it('should allow overriding properties', () => {
      const message = createMockMessage({
        role: 'assistant',
        content: 'Custom content',
      });
      expect(message.role).toBe('assistant');
      expect(message.content).toBe('Custom content');
    });
  });

  describe('createMockToolError', () => {
    it('should create a failed ToolResult with error', () => {
      const result = createMockToolError('Test error');
      expect(result.success).toBe(false);
      expect(result.output).toBe('');
      expect(result.error).toBe('Test error');
    });
  });

  describe('createMockAssistantMessage', () => {
    it('should create an assistant message', () => {
      const message = createMockAssistantMessage('Hello!');
      expect(message.role).toBe('assistant');
      expect(message.content).toBe('Hello!');
      expect(message.timestamp).toBeDefined();
    });
  });

  describe('createMockToolMessage', () => {
    it('should create a tool message with toolCallId', () => {
      const message = createMockToolMessage('Tool result', 'call-123');
      expect(message.role).toBe('tool');
      expect(message.content).toBe('Tool result');
      expect(message.toolCallId).toBe('call-123');
      expect(message.timestamp).toBeDefined();
    });
  });
});
