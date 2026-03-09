// src/tools/base.ts — Abstract Base Tool Class

import type { ToolResult, ToolContext } from '../types/index.js';

/**
 * Abstract base class that enforces the Tool interface.
 * All concrete tools must extend this class and implement the abstract members.
 */
export abstract class BaseTool {
  /** Unique tool name */
  abstract readonly name: string;

  /** Human-readable description of what the tool does */
  abstract readonly description: string;

  /** JSON Schema describing the tool's input parameters */
  abstract readonly inputSchema: Record<string, unknown>;

  /**
   * Execute the tool with the given input.
   * @param input - Input parameters matching the inputSchema
   * @param context - Optional context with cross-cutting concerns (signal, permissions, eventBus)
   * @returns Promise resolving to a ToolResult
   */
  abstract execute(input: Record<string, unknown>, context?: ToolContext): Promise<ToolResult>;
}
