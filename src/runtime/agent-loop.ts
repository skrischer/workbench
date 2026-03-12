// src/runtime/agent-loop.ts — Consolidated Agent Runtime Loop with Lifecycle Hooks

import { randomUUID } from 'node:crypto';
import type {
  AgentConfig,
  RunResult,
  LLMMessage,
  LLMToolDef,
  LLMUsage,
  ContentBlock,
  ToolUseBlock,
  ToolResultBlock,
  UserMessage,
  AssistantMessage,
  ToolResultMessage,
  Session,
  ToolResult,
  ToolContext,
} from '../types/index.js';
import type { AnthropicClient } from '../llm/anthropic-client.js';
import type { SessionStorage } from '../storage/session-storage.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { TypedEventBus } from '../events/event-bus.js';
import type { StreamDelta } from '../llm/streaming.js';
import { validateToolInput } from '../tools/validator.js';
import { PermissionGuard, PermissionError } from '../tools/permissions.js';

/**
 * Lifecycle hooks for agent runs
 * Enables extensibility without modifying core loop logic
 */
export interface AgentLoopHooks {
  /** Called before run starts (after session creation) */
  onBeforeRun?: (session: Session) => Promise<void>;
  
  /** Called after each tool execution */
  onAfterStep?: (step: ToolResult, context: { runId: string; stepIndex: number; toolName: string }) => Promise<void>;
  
  /** Called after run completes (success or failure) */
  onAfterRun?: (result: RunResult, context: { runId: string }) => Promise<void>;
}

/**
 * AgentLoop — Core agent runtime loop with optional lifecycle hooks
 * 
 * Orchestrates the agent execution cycle:
 * 1. Creates a session
 * 2. Calls onBeforeRun hook (if provided)
 * 3. Sends messages to LLM
 * 4. Executes tool calls
 * 5. Calls onAfterStep hook after each tool execution (if provided)
 * 6. Repeats until completion or max steps
 * 7. Calls onAfterRun hook (if provided)
 * 
 * Without hooks, behaves like a pure LLM loop.
 * With hooks, enables Git integration, logging, metrics, custom observers, etc.
 */
export class AgentLoop {
  private activeControllers: Map<string, AbortController> = new Map();
  private permissionGuard?: PermissionGuard;
  private agentId: string;
  private anthropicClient: AnthropicClient;
  private sessionStorage: SessionStorage;
  private toolRegistry: ToolRegistry;
  private config: AgentConfig;
  private eventBus?: TypedEventBus;
  private hooks?: AgentLoopHooks;
  private agentRegistry?: any; // AgentRegistry (avoid circular import)
  private orchestrator?: any; // Orchestrator (avoid circular import)

  constructor(
    anthropicClient: AnthropicClient,
    sessionStorage: SessionStorage,
    toolRegistry: ToolRegistry,
    config: AgentConfig,
    eventBus?: TypedEventBus,
    hooks?: AgentLoopHooks,
    agentId?: string,
    agentRegistry?: any,
    orchestrator?: any
  ) {
    // Generate agentId if not provided (for backward compatibility)
    // Default to 'agent-runtime' for tests, otherwise UUID
    this.agentId = agentId ?? 'agent-runtime';
    this.anthropicClient = anthropicClient;
    this.sessionStorage = sessionStorage;
    this.toolRegistry = toolRegistry;
    this.config = config;
    this.eventBus = eventBus;
    this.hooks = hooks;
    this.agentRegistry = agentRegistry;
    this.orchestrator = orchestrator;

    // Initialize permission guard if allowedPaths are configured
    if (config.allowedPaths && config.allowedPaths.length > 0) {
      this.permissionGuard = new PermissionGuard(config.allowedPaths);
    }
  }

  /**
   * Run the agent with a user prompt
   * @param prompt - User input to process
   * @returns RunResult with session ID, steps taken, final response, and status
   */
  async run(prompt: string): Promise<RunResult> {
    // 1. Create session
    const session = await this.sessionStorage.create(this.agentId);
    const runId = session.id;
    
    // Create AbortController for this run
    const abortController = new AbortController();
    this.activeControllers.set(runId, abortController);
    
    // Emit run:start event
    this.eventBus?.emit('run:start', {
      runId,
      agentConfig: this.config,
      prompt,
    });
    
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
      // 3. Call onBeforeRun hook
      if (this.hooks?.onBeforeRun) {
        const currentSession = await this.sessionStorage.load(session.id);
        await this.hooks.onBeforeRun(currentSession);
      }

      // 4. Main loop
      while (step < this.config.maxSteps) {
        step++;

        // a. Load current session state and convert messages
        const currentSession = await this.sessionStorage.load(session.id);
        const llmMessages = this.convertToLLMMessages(currentSession.messages);

        // b. Get tool definitions
        const tools = this.getToolDefinitions();

        // Emit llm:request event
        this.eventBus?.emit('llm:request', {
          runId,
          model: this.config.model ?? 'unknown',
          messageCount: llmMessages.length,
        });

        // c. Send to LLM
        const response = await this.anthropicClient.sendMessage(
          llmMessages,
          tools.length > 0 ? tools : undefined,
          { system: this.config.systemPrompt }
        );

        // Track token usage
        totalUsage.input_tokens += response.usage.input_tokens;
        totalUsage.output_tokens += response.usage.output_tokens;

        // Emit llm:response event
        this.eventBus?.emit('llm:response', {
          runId,
          model: this.config.model ?? 'unknown',
          tokenUsage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          },
          rateLimit: response.rateLimit,
        });

        // d. Save assistant response
        const assistantContent = this.extractTextContent(response.content);
        const toolUseBlocks = response.content.filter(
          (block): block is ToolUseBlock => block.type === 'tool_use'
        );
        const assistantMessage: AssistantMessage = {
          role: 'assistant',
          content: assistantContent,
          toolUses: toolUseBlocks.length > 0 ? toolUseBlocks : undefined,
          timestamp: new Date().toISOString(),
        };
        await this.sessionStorage.addMessage(session.id, assistantMessage);

        // Emit run:step event
        this.eventBus?.emit('run:step', {
          runId,
          stepIndex: step,
          message: assistantMessage,
        });

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
            // Emit tool:call event
            this.eventBus?.emit('tool:call', {
              runId,
              toolName: toolUse.name,
              input: toolUse.input,
              stepIndex: step,
            });

            // Execute tool and measure duration
            const startTime = performance.now();
            const toolResult = await this.executeTool(toolUse, runId);
            const durationMs = performance.now() - startTime;

            // Emit tool:result event
            this.eventBus?.emit('tool:result', {
              runId,
              toolName: toolUse.name,
              result: {
                success: !toolResult.is_error,
                output: toolResult.content,
                error: toolResult.is_error ? toolResult.content : undefined,
              },
              durationMs,
            });
            
            // Save tool result as message
            const toolResultMessage: ToolResultMessage = {
              role: 'tool_result',
              content: toolResult.content,
              toolCallId: toolResult.tool_use_id,
              timestamp: new Date().toISOString(),
            };
            await this.sessionStorage.addMessage(session.id, toolResultMessage);

            // 5. Call onAfterStep hook (only for successful tool executions)
            if (this.hooks?.onAfterStep && !toolResult.is_error) {
              const stepResult: ToolResult = {
                success: !toolResult.is_error,
                output: toolResult.content,
                error: toolResult.is_error ? toolResult.content : undefined,
              };
              try {
                await this.hooks.onAfterStep(stepResult, {
                  runId,
                  stepIndex: step,
                  toolName: toolUse.name,
                });
              } catch (hookError) {
                // Mark as hook error so it can be re-thrown in the main catch block
                (hookError as any).__isHookError = true;
                throw hookError;
              }
            }

            // 6. After spawn_agent tool execution: run the spawned agent
            if (toolUse.name === 'spawn_agent' && !toolResult.is_error && this.orchestrator) {
              try {
                // Extract agentId from metadata (spawn_agent returns it in metadata.id)
                const agentId = toolResult.metadata?.id as string | undefined;
                
                if (agentId) {
                  // Fire-and-forget: run agent in background
                  // We don't await here to allow parent agent to continue
                  this.orchestrator.runAgent(agentId).catch((error: Error) => {
                    console.error(`[AgentLoop] Failed to run spawned agent ${agentId}:`, error);
                  });
                } else {
                  console.error('[AgentLoop] spawn_agent succeeded but no agentId in metadata');
                }
              } catch (error) {
                console.error('[AgentLoop] Failed to handle spawn_agent:', error);
              }
            }
          }

          // Save session after tool execution
          await this.sessionStorage.save(await this.sessionStorage.load(session.id));
          
          // ✅ CHECK: Haben wir maxSteps erreicht und sind noch nicht fertig?
          if (step >= this.config.maxSteps) {
            status = 'max_steps_reached';
            // Use last assistant message as final response
            const currentSession = await this.sessionStorage.load(session.id);
            const lastAssistantMsg = [...currentSession.messages]
              .reverse()
              .find(msg => msg.role === 'assistant');
            finalResponse = lastAssistantMsg?.content ?? 'Max steps reached without completion';
            break;
          }
          
          // Continue loop for next LLM call
          continue;
        }

        // Other stop reasons (max_tokens, stop_sequence)
        status = 'completed';
        finalResponse = assistantContent;
        break;
      }

      // 6. Save final session state
      await this.sessionStorage.save(await this.sessionStorage.load(session.id));

      // Build result
      const result: RunResult = {
        sessionId: session.id,
        steps: step,
        finalResponse,
        tokenUsage: totalUsage,
        status,
      };

      // 7. Call onAfterRun hook
      if (this.hooks?.onAfterRun) {
        await this.hooks.onAfterRun(result, { runId });
      }

      // Emit run:end event
      this.eventBus?.emit('run:end', {
        runId,
        result: finalResponse,
        tokenUsage: {
          inputTokens: totalUsage.input_tokens,
          outputTokens: totalUsage.output_tokens,
          totalTokens: totalUsage.input_tokens + totalUsage.output_tokens,
        },
      });

      // 8. Return result
      return result;

    } catch (error) {
      // Re-throw hook errors instead of catching them
      if ((error as any).__isHookError) {
        throw error;
      }
      
      // Handle errors
      status = 'failed';
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Build error result
      const result: RunResult = {
        sessionId: session.id,
        steps: step,
        finalResponse: `Error: ${errorMessage}`,
        tokenUsage: totalUsage,
        status,
      };

      // Call onAfterRun hook even on failure
      if (this.hooks?.onAfterRun) {
        try {
          await this.hooks.onAfterRun(result, { runId });
        } catch (hookError) {
          console.error('[AgentLoop] onAfterRun hook failed:', hookError);
        }
      }

      // Emit run:error event
      this.eventBus?.emit('run:error', {
        runId,
        error: errorMessage,
      });
      
      return result;
    } finally {
      // Clean up AbortController
      this.activeControllers.delete(runId);
    }
  }

  /**
   * Run the agent with streaming LLM responses.
   * Emits llm:stream:delta events for each text token.
   *
   * @param prompt - User input to process
   * @param sessionId - Optional existing session ID to resume
   * @returns RunResult
   */
  async runStreaming(prompt: string, sessionId?: string): Promise<RunResult> {
    // 1. Create or load session
    let session: Session;
    if (sessionId) {
      session = await this.sessionStorage.load(sessionId);
    } else {
      session = await this.sessionStorage.create(this.agentId);
    }
    const runId = session.id;

    // Create AbortController for this run
    const abortController = new AbortController();
    this.activeControllers.set(runId, abortController);

    // Emit run:start event
    this.eventBus?.emit('run:start', {
      runId,
      agentConfig: this.config,
      prompt,
    });

    // Add initial user message
    const userMessage: UserMessage = {
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
    };
    await this.sessionStorage.addMessage(session.id, userMessage);

    let step = 0;
    let status: RunResult['status'] = 'completed';
    let totalUsage: LLMUsage = { input_tokens: 0, output_tokens: 0 };
    let finalResponse = '';

    try {
      if (this.hooks?.onBeforeRun) {
        const currentSession = await this.sessionStorage.load(session.id);
        await this.hooks.onBeforeRun(currentSession);
      }

      while (step < this.config.maxSteps) {
        step++;

        const currentSession = await this.sessionStorage.load(session.id);
        const llmMessages = this.convertToLLMMessages(currentSession.messages);
        const tools = this.getToolDefinitions();

        this.eventBus?.emit('llm:request', {
          runId,
          model: this.config.model ?? 'unknown',
          messageCount: llmMessages.length,
        });

        // Use streaming API
        const stream = await this.anthropicClient.sendMessageStream(
          llmMessages,
          tools.length > 0 ? tools : undefined,
          { system: this.config.systemPrompt, signal: abortController.signal }
        );

        // Collect response from stream
        let textContent = '';
        const toolUseBlocks: ToolUseBlock[] = [];
        let currentToolId = '';
        let currentToolName = '';
        let currentToolInput = '';
        let streamInputTokens = 0;
        let streamOutputTokens = 0;

        for await (const delta of stream) {
          if (delta.type === 'message_start') {
            streamInputTokens = delta.inputTokens;
          } else if (delta.type === 'text_delta') {
            textContent += delta.text;
            this.eventBus?.emit('llm:stream:delta', { runId, text: delta.text });
          } else if (delta.type === 'tool_use_start') {
            currentToolId = delta.toolId;
            currentToolName = delta.toolName;
            currentToolInput = '';
            this.eventBus?.emit('llm:stream:tool_start', {
              runId,
              toolName: delta.toolName,
              toolId: delta.toolId,
            });
          } else if (delta.type === 'tool_input_delta') {
            currentToolInput += delta.inputDelta;
            this.eventBus?.emit('llm:stream:tool_input', {
              runId,
              toolId: currentToolId,
              inputDelta: delta.inputDelta,
            });
          } else if (delta.type === 'content_block_stop') {
            if (currentToolId && currentToolName) {
              let parsedInput: Record<string, unknown> = {};
              try {
                parsedInput = JSON.parse(currentToolInput) as Record<string, unknown>;
              } catch {
                // Keep empty if unparseable
              }
              toolUseBlocks.push({
                type: 'tool_use',
                id: currentToolId,
                name: currentToolName,
                input: parsedInput,
              });
              currentToolId = '';
              currentToolName = '';
              currentToolInput = '';
            }
          } else if (delta.type === 'message_delta') {
            streamOutputTokens = delta.outputTokens;
          } else if (delta.type === 'message_stop') {
            this.eventBus?.emit('llm:stream:stop', { runId });
          }
        }

        // Accumulate token usage from stream
        totalUsage.input_tokens += streamInputTokens;
        totalUsage.output_tokens += streamOutputTokens;

        // Emit llm:response event with streaming usage + rate limits
        this.eventBus?.emit('llm:response', {
          runId,
          model: this.config.model ?? 'unknown',
          tokenUsage: {
            inputTokens: streamInputTokens,
            outputTokens: streamOutputTokens,
          },
          rateLimit: stream.rateLimit,
        });

        // Save assistant message
        const assistantMessage: AssistantMessage = {
          role: 'assistant',
          content: textContent,
          toolUses: toolUseBlocks.length > 0 ? toolUseBlocks : undefined,
          timestamp: new Date().toISOString(),
        };
        await this.sessionStorage.addMessage(session.id, assistantMessage);

        this.eventBus?.emit('run:step', {
          runId,
          stepIndex: step,
          message: assistantMessage,
        });

        // No tool calls → done
        if (toolUseBlocks.length === 0) {
          status = 'completed';
          finalResponse = textContent;
          break;
        }

        // Execute tool calls
        for (const toolUse of toolUseBlocks) {
          this.eventBus?.emit('tool:call', {
            runId,
            toolName: toolUse.name,
            input: toolUse.input,
            stepIndex: step,
          });

          const startTime = performance.now();
          const toolResult = await this.executeTool(toolUse, runId);
          const durationMs = performance.now() - startTime;

          this.eventBus?.emit('tool:result', {
            runId,
            toolName: toolUse.name,
            result: {
              success: !toolResult.is_error,
              output: toolResult.content,
              error: toolResult.is_error ? toolResult.content : undefined,
            },
            durationMs,
          });

          const toolResultMessage: ToolResultMessage = {
            role: 'tool_result',
            content: toolResult.content,
            toolCallId: toolResult.tool_use_id,
            timestamp: new Date().toISOString(),
          };
          await this.sessionStorage.addMessage(session.id, toolResultMessage);

          if (this.hooks?.onAfterStep && !toolResult.is_error) {
            const stepResult: ToolResult = {
              success: !toolResult.is_error,
              output: toolResult.content,
              error: toolResult.is_error ? toolResult.content : undefined,
            };
            await this.hooks.onAfterStep(stepResult, {
              runId,
              stepIndex: step,
              toolName: toolUse.name,
            });
          }
        }

        await this.sessionStorage.save(await this.sessionStorage.load(session.id));

        if (step >= this.config.maxSteps) {
          status = 'max_steps_reached';
          finalResponse = textContent || 'Max steps reached without completion';
          break;
        }
      }

      await this.sessionStorage.save(await this.sessionStorage.load(session.id));

      const result: RunResult = {
        sessionId: session.id,
        steps: step,
        finalResponse,
        tokenUsage: totalUsage,
        status,
      };

      if (this.hooks?.onAfterRun) {
        await this.hooks.onAfterRun(result, { runId });
      }

      this.eventBus?.emit('run:end', {
        runId,
        result: finalResponse,
        tokenUsage: {
          inputTokens: totalUsage.input_tokens,
          outputTokens: totalUsage.output_tokens,
          totalTokens: totalUsage.input_tokens + totalUsage.output_tokens,
        },
      });

      return result;
    } catch (error) {
      if ((error as Record<string, unknown>).__isHookError) throw error;

      const errorMessage = error instanceof Error ? error.message : String(error);
      const result: RunResult = {
        sessionId: session.id,
        steps: step,
        finalResponse: `Error: ${errorMessage}`,
        tokenUsage: totalUsage,
        status: 'failed',
      };

      if (this.hooks?.onAfterRun) {
        try {
          await this.hooks.onAfterRun(result, { runId });
        } catch {
          // Ignore hook errors on failure path
        }
      }

      this.eventBus?.emit('run:error', { runId, error: errorMessage });
      return result;
    } finally {
      this.activeControllers.delete(runId);
    }
  }

  /**
   * Cancel a running agent execution
   * @param runId - The run ID to cancel
   * @returns true if the run was found and cancelled, false otherwise
   */
  cancel(runId: string): boolean {
    const controller = this.activeControllers.get(runId);
    if (controller) {
      controller.abort();
      return true;
    }
    return false;
  }

  /**
   * Check if a run is currently active
   * @param runId - The run ID to check
   * @returns true if the run is active, false otherwise
   */
  isRunActive(runId: string): boolean {
    return this.activeControllers.has(runId);
  }

  /**
   * Convert session messages to LLM format
   */
  private convertToLLMMessages(messages: Array<{ role: string; content: string; toolCallId?: string; toolUses?: ToolUseBlock[] }>): LLMMessage[] {
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
        // If message has tool uses, build ContentBlock[] with text + tool_use blocks
        if (msg.toolUses && msg.toolUses.length > 0) {
          const contentBlocks: ContentBlock[] = [];
          
          // Add text block if content is not empty
          if (msg.content.trim()) {
            contentBlocks.push({
              type: 'text',
              text: msg.content,
            });
          }
          
          // Add tool use blocks
          contentBlocks.push(...msg.toolUses);
          
          llmMessages.push({
            role: 'assistant',
            content: contentBlocks,
          });
        } else {
          // Plain text assistant message
          llmMessages.push({
            role: 'assistant',
            content: msg.content,
          });
        }
      } else if (msg.role === 'tool' || msg.role === 'tool_result') {
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
    // ✅ If no tools specified, use all available
    let toolNames = this.config.tools ?? [];
    if (toolNames.length === 0) {
      toolNames = this.toolRegistry.list();
    }
    
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
   * Execute a tool and return the result as ToolResultBlock with metadata
   */
  private async executeTool(toolUse: ToolUseBlock, runId: string): Promise<ToolResultBlock & { metadata?: Record<string, unknown> }> {
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

      // Validate tool input against schema before execution
      const validation = validateToolInput(tool.inputSchema, toolUse.input as Record<string, unknown>);
      if (!validation.valid) {
        return {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: `Input validation failed for tool "${toolUse.name}":\n${validation.errors!.join('\n')}`,
          is_error: true,
        };
      }

      // PERMISSION CHECK MIDDLEWARE — Check path permissions before execution
      if (this.permissionGuard && this.isWritingTool(toolUse.name)) {
        const targetPath = this.extractTargetPath(toolUse.name, toolUse.input);
        
        if (targetPath) {
          try {
            this.permissionGuard.checkPath(targetPath);
          } catch (error) {
            if (error instanceof PermissionError) {
              return {
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: `Permission denied: ${error.message}`,
                is_error: true,
              };
            }
            throw error; // Re-throw if it's not a PermissionError
          }
        }
      }

      // Build ToolContext with AbortSignal and PermissionGuard
      const abortController = this.activeControllers.get(runId);
      const context: ToolContext = {
        agentId: this.agentId,
        signal: abortController?.signal,
        permissions: this.permissionGuard,
        eventBus: this.eventBus,
        metadata: {
          runId,
          toolCallId: toolUse.id,
        },
      };

      const result = await tool.execute(toolUse.input, context);

      return {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result.success ? result.output : `Error: ${result.error ?? 'Unknown error'}`,
        is_error: !result.success,
        metadata: result.metadata, // Preserve metadata (e.g., agentId from spawn_agent)
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

  /**
   * Check if a tool is a writing tool that needs permission checks
   */
  private isWritingTool(toolName: string): boolean {
    // Known writing tools by name
    const writingTools = [
      'write_file',
      'edit_file',
      'apply_patch',
      'exec', // exec can modify files via cwd
    ];
    
    return writingTools.includes(toolName);
  }

  /**
   * Extract target path from tool input for permission checking
   */
  private extractTargetPath(toolName: string, input: Record<string, unknown>): string | null {
    // Different tools have different path parameters
    if (toolName === 'exec') {
      return (input.cwd as string) || null;
    }
    
    // Most file tools use 'path' parameter
    return (input.path as string) || null;
  }
}
