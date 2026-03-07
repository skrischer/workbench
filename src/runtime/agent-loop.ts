// src/runtime/agent-loop.ts — Agent Runtime Loop

import type {
  AgentConfig,
  RunResult,
  LLMMessage,
  LLMToolDef,
  LLMUsage,
  ContentBlock,
  ToolUseBlock,
  ToolResultBlock,
  StorageMessage,
  UserMessage,
  AssistantMessage,
  ToolResultMessage,
} from '../types/index.js';
import type { AnthropicClient } from '../llm/anthropic-client.js';
import type { SessionStorage } from '../storage/session-storage.js';
import type { ToolRegistry } from '../tools/registry.js';

/**
 * AgentLoop — Core agent runtime loop
 * 
 * Orchestrates the agent execution cycle:
 * 1. Creates a session
 * 2. Sends messages to LLM
 * 3. Executes tool calls
 * 4. Repeats until completion or max steps
 */
export class AgentLoop {
  constructor(
    private anthropicClient: AnthropicClient,
    private sessionStorage: SessionStorage,
    private toolRegistry: ToolRegistry,
    private config: AgentConfig
  ) {}

  /**
   * Run the agent with a user prompt
   * @param prompt - User input to process
   * @returns RunResult with session ID, steps taken, final response, and status
   */
  async run(prompt: string): Promise<RunResult> {
    // 1. Create session
    const session = await this.sessionStorage.create('agent-runtime');
    
    // 2. Add initial user message
    const userMessage: UserMessage = {
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
    };
    await this.sessionStorage.addMessage(session.id, userMessage);

    // Initialize tracking
    let step = 0;
    let status: RunResult['status'] = 'completed';
    let totalUsage: LLMUsage = {
      input_tokens: 0,
      output_tokens: 0,
    };
    let finalResponse = '';

    try {
      // 3. Main loop
      while (step < this.config.maxSteps) {
        step++;

        // a. Load current session state and convert messages
        const currentSession = await this.sessionStorage.load(session.id);
        const llmMessages = this.convertToLLMMessages(currentSession.messages);

        // b. Get tool definitions
        const tools = this.getToolDefinitions();

        // c. Send to LLM
        const response = await this.anthropicClient.sendMessage(
          llmMessages,
          tools.length > 0 ? tools : undefined,
          { system: this.config.systemPrompt }
        );

        // Track token usage
        totalUsage.input_tokens += response.usage.input_tokens;
        totalUsage.output_tokens += response.usage.output_tokens;

        // d. Save assistant response
        const assistantContent = this.extractTextContent(response.content);
        const assistantMessage: AssistantMessage = {
          role: 'assistant',
          content: assistantContent,
          timestamp: new Date().toISOString(),
        };
        await this.sessionStorage.addMessage(session.id, assistantMessage);

        // e. Handle stop reason
        if (response.stop_reason === 'end_turn') {
          status = 'completed';
          finalResponse = assistantContent;
          break;
        }

        if (response.stop_reason === 'tool_use') {
          // Extract tool use blocks
          const toolUseBlocks = response.content.filter(
            (block): block is ToolUseBlock => block.type === 'tool_use'
          );

          // Execute each tool and collect results
          for (const toolUse of toolUseBlocks) {
            const toolResult = await this.executeTool(toolUse);
            
            // Save tool result as message
            const toolResultMessage: ToolResultMessage = {
              role: 'tool_result',
              content: toolResult.content,
              toolCallId: toolResult.tool_use_id,
              timestamp: new Date().toISOString(),
            };
            await this.sessionStorage.addMessage(session.id, toolResultMessage);
          }

          // Save session after tool execution
          await this.sessionStorage.save(await this.sessionStorage.load(session.id));
          
          // Continue loop for next LLM call
          continue;
        }

        // Other stop reasons (max_tokens, stop_sequence)
        status = 'completed';
        finalResponse = assistantContent;
        break;
      }

      // Check if we hit max steps
      if (step >= this.config.maxSteps && status !== 'completed') {
        status = 'max_steps_reached';
        // Use last assistant message as final response
        const currentSession = await this.sessionStorage.load(session.id);
        const lastAssistantMsg = [...currentSession.messages]
          .reverse()
          .find(msg => msg.role === 'assistant');
        finalResponse = lastAssistantMsg?.content ?? 'Max steps reached without completion';
      }

      // 4. Save final session state
      await this.sessionStorage.save(await this.sessionStorage.load(session.id));

      // 5. Return result
      return {
        sessionId: session.id,
        steps: step,
        finalResponse,
        tokenUsage: totalUsage,
        status,
      };

    } catch (error) {
      // Handle errors
      status = 'failed';
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        sessionId: session.id,
        steps: step,
        finalResponse: `Error: ${errorMessage}`,
        tokenUsage: totalUsage,
        status,
      };
    }
  }

  /**
   * Convert session messages to LLM format
   */
  private convertToLLMMessages(messages: Array<{ role: string; content: string; toolCallId?: string }>): LLMMessage[] {
    const llmMessages: LLMMessage[] = [];
    const toolResultBuffer: ToolResultBlock[] = [];

    for (const msg of messages) {
      if (msg.role === 'user') {
        // Flush any buffered tool results first
        if (toolResultBuffer.length > 0) {
          llmMessages.push({
            role: 'user',
            content: [...toolResultBuffer],
          });
          toolResultBuffer.length = 0;
        }
        // Add user message
        llmMessages.push({
          role: 'user',
          content: msg.content,
        });
      } else if (msg.role === 'assistant') {
        // Flush any buffered tool results first
        if (toolResultBuffer.length > 0) {
          llmMessages.push({
            role: 'user',
            content: [...toolResultBuffer],
          });
          toolResultBuffer.length = 0;
        }
        // Add assistant message
        llmMessages.push({
          role: 'assistant',
          content: msg.content,
        });
      } else if (msg.role === 'tool') {
        // Buffer tool results (they get sent as user messages with ToolResultBlock content)
        toolResultBuffer.push({
          type: 'tool_result',
          tool_use_id: msg.toolCallId ?? '',
          content: msg.content,
          is_error: msg.content.includes('Error:'), // Simple heuristic
        });
      }
    }

    // Flush remaining tool results
    if (toolResultBuffer.length > 0) {
      llmMessages.push({
        role: 'user',
        content: [...toolResultBuffer],
      });
    }

    return llmMessages;
  }

  /**
   * Get tool definitions for LLM
   */
  private getToolDefinitions(): LLMToolDef[] {
    const toolNames = this.config.tools ?? [];
    const definitions: LLMToolDef[] = [];

    for (const name of toolNames) {
      const tool = this.toolRegistry.get(name);
      if (tool) {
        definitions.push({
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        });
      }
    }

    return definitions;
  }

  /**
   * Execute a tool and return the result as ToolResultBlock
   */
  private async executeTool(toolUse: ToolUseBlock): Promise<ToolResultBlock> {
    try {
      const tool = this.toolRegistry.get(toolUse.name);
      
      if (!tool) {
        return {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: `Error: Tool "${toolUse.name}" not found in registry`,
          is_error: true,
        };
      }

      const result = await tool.execute(toolUse.input);

      return {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result.success ? result.output : `Error: ${result.error ?? 'Unknown error'}`,
        is_error: !result.success,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: `Error executing tool: ${errorMessage}`,
        is_error: true,
      };
    }
  }

  /**
   * Extract text content from ContentBlocks
   */
  private extractTextContent(blocks: ContentBlock[]): string {
    const textBlocks = blocks
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map(block => block.text);
    
    return textBlocks.join('\n');
  }
}
