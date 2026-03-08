import { describe, it, expect } from 'vitest';
import {
  simpleText,
  toolUseReadFile,
  toolUseWriteFile,
  multiTurn,
  error401,
  error429,
  tokens,
  agentConfig,
} from '../__fixtures__/index.js';

describe('Test Fixtures', () => {
  describe('Response Fixtures', () => {
    it('simpleText should have correct message structure', () => {
      expect(simpleText).toBeDefined();
      expect(simpleText.type).toBe('message');
      expect(simpleText.id).toBe('msg_test_001');
      expect(simpleText.role).toBe('assistant');
      expect(simpleText.content).toBeInstanceOf(Array);
      expect(simpleText.content).toHaveLength(1);
      expect(simpleText.content[0]).toMatchObject({
        type: 'text',
        text: expect.any(String),
      });
      expect(simpleText.stop_reason).toBe('end_turn');
      expect(simpleText.usage).toMatchObject({
        input_tokens: expect.any(Number),
        output_tokens: expect.any(Number),
      });
    });

    it('toolUseReadFile should have tool_use content block', () => {
      expect(toolUseReadFile).toBeDefined();
      expect(toolUseReadFile.type).toBe('message');
      expect(toolUseReadFile.content).toHaveLength(2);
      
      const toolUseBlock = toolUseReadFile.content.find(
        (block: { type: string }) => block.type === 'tool_use'
      );
      expect(toolUseBlock).toBeDefined();
      expect(toolUseBlock).toMatchObject({
        type: 'tool_use',
        id: expect.any(String),
        name: 'read_file',
        input: {
          path: expect.any(String),
        },
      });
      expect(toolUseReadFile.stop_reason).toBe('tool_use');
    });

    it('toolUseWriteFile should have write_file tool_use', () => {
      expect(toolUseWriteFile).toBeDefined();
      expect(toolUseWriteFile.type).toBe('message');
      
      const toolUseBlock = toolUseWriteFile.content.find(
        (block: { type: string }) => block.type === 'tool_use'
      );
      expect(toolUseBlock).toBeDefined();
      expect(toolUseBlock).toMatchObject({
        type: 'tool_use',
        name: 'write_file',
        input: {
          path: expect.any(String),
          content: expect.any(String),
        },
      });
    });

    it('multiTurn should be an array of responses', () => {
      expect(multiTurn).toBeInstanceOf(Array);
      expect(multiTurn).toHaveLength(2);
      
      // First response should be tool_use
      expect(multiTurn[0].type).toBe('message');
      expect(multiTurn[0].stop_reason).toBe('tool_use');
      
      // Second response should be final text
      expect(multiTurn[1].type).toBe('message');
      expect(multiTurn[1].stop_reason).toBe('end_turn');
    });
  });

  describe('Error Fixtures', () => {
    it('error401 should have error structure', () => {
      expect(error401).toBeDefined();
      expect(error401.type).toBe('error');
      expect(error401.error).toMatchObject({
        type: 'authentication_error',
        message: expect.any(String),
      });
    });

    it('error429 should have rate_limit_error type', () => {
      expect(error429).toBeDefined();
      expect(error429.type).toBe('error');
      expect(error429.error).toMatchObject({
        type: 'rate_limit_error',
        message: expect.any(String),
      });
    });
  });

  describe('Config Fixtures', () => {
    it('tokens should have required OAuth fields', () => {
      expect(tokens).toBeDefined();
      expect(tokens).toHaveProperty('access_token');
      expect(tokens).toHaveProperty('refresh_token');
      expect(tokens).toHaveProperty('expires_at');
      expect(typeof tokens.access_token).toBe('string');
      expect(typeof tokens.refresh_token).toBe('string');
      expect(typeof tokens.expires_at).toBe('number');
      expect(tokens.expires_at).toBeGreaterThan(Date.now());
    });

    it('agentConfig should have basic agent properties', () => {
      expect(agentConfig).toBeDefined();
      expect(agentConfig).toHaveProperty('name');
      expect(agentConfig).toHaveProperty('model');
      expect(typeof agentConfig.name).toBe('string');
      expect(typeof agentConfig.model).toBe('string');
    });
  });
});
