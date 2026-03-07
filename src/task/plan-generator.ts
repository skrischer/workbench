// src/task/plan-generator.ts — LLM-based Plan Generation

import { randomUUID } from 'node:crypto';
import type { Plan } from '../types/task.js';
import { validatePlan } from './validation.js';
import { PLAN_GENERATION_SYSTEM_PROMPT, createPlanGenerationUserPrompt } from './plan-prompt.js';

/**
 * Configuration for plan generation
 */
export interface PlanGeneratorConfig {
  /** Model identifier (e.g., "gpt-4", "claude-3-sonnet") */
  model: string;

  /** Function to call LLM with messages and get response */
  llmCall: (messages: Array<{ role: string; content: string }>) => Promise<string>;

  /** Maximum number of retries on parse/validation error (default: 1) */
  maxRetries?: number;
}

/**
 * Raw plan structure from LLM (before adding metadata)
 */
interface RawPlanFromLLM {
  title: string;
  description: string;
  steps: Array<{
    id: string;
    title: string;
    prompt: string;
    status: 'pending';
    dependsOn?: string[];
    toolHints?: string[];
    maxSteps?: number;
  }>;
}

/**
 * PlanGenerator — Generates structured execution plans using LLM
 */
export class PlanGenerator {
  private config: Required<PlanGeneratorConfig>;

  constructor(config: PlanGeneratorConfig) {
    this.config = {
      ...config,
      maxRetries: config.maxRetries ?? 1,
    };
  }

  /**
   * Generate an execution plan from a user prompt
   * @param userPrompt - The user's request to plan for
   * @returns A validated Plan object with UUID and timestamps
   * @throws Error if plan generation fails after retries
   */
  async generate(userPrompt: string): Promise<Plan> {
    let lastError: Error | null = null;
    const maxAttempts = this.config.maxRetries + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const messages = this.buildMessages(userPrompt, lastError);
        const response = await this.config.llmCall(messages);
        const rawPlan = this.parseResponse(response);
        const plan = this.enrichPlan(rawPlan, userPrompt);

        // Validate the generated plan
        validatePlan(plan);

        return plan;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // If this was the last attempt, throw
        if (attempt === maxAttempts - 1) {
          throw new Error(
            `Plan generation failed after ${maxAttempts} attempt(s): ${lastError.message}`
          );
        }

        // Otherwise, retry with error feedback
        console.warn(`Plan generation attempt ${attempt + 1} failed: ${lastError.message}`);
      }
    }

    // Should never reach here due to throw above, but TypeScript needs this
    throw new Error('Plan generation failed');
  }

  /**
   * Build message array for LLM call
   */
  private buildMessages(
    userPrompt: string,
    previousError: Error | null
  ): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: PLAN_GENERATION_SYSTEM_PROMPT },
      { role: 'user', content: createPlanGenerationUserPrompt(userPrompt) },
    ];

    // Add error feedback on retry
    if (previousError) {
      messages.push({
        role: 'user',
        content: `The previous plan had an error: ${previousError.message}\n\nPlease generate a corrected plan that addresses this error.`,
      });
    }

    return messages;
  }

  /**
   * Parse LLM response and extract JSON
   * Tries direct parse first, then extracts from markdown code block
   */
  private parseResponse(response: string): RawPlanFromLLM {
    let jsonString = response.trim();

    // Try direct parse first
    try {
      return JSON.parse(jsonString) as RawPlanFromLLM;
    } catch {
      // Failed, try to extract from markdown code block
      const codeBlockMatch = jsonString.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
      if (codeBlockMatch) {
        jsonString = codeBlockMatch[1].trim();
        try {
          return JSON.parse(jsonString) as RawPlanFromLLM;
        } catch (parseError) {
          throw new Error(
            `Failed to parse JSON from code block: ${parseError instanceof Error ? parseError.message : String(parseError)}`
          );
        }
      }

      throw new Error('Response is not valid JSON and does not contain a JSON code block');
    }
  }

  /**
   * Enrich raw plan with metadata, UUID, timestamps, and status
   */
  private enrichPlan(rawPlan: RawPlanFromLLM, originalPrompt: string): Plan {
    const now = new Date().toISOString();

    return {
      id: randomUUID(),
      title: rawPlan.title,
      description: rawPlan.description,
      status: 'pending',
      steps: rawPlan.steps,
      currentStepIndex: 0,
      createdAt: now,
      updatedAt: now,
      metadata: {
        originalPrompt,
        model: this.config.model,
      },
    };
  }
}

/**
 * Convenience function to generate a plan with a single call
 */
export async function generatePlan(
  userPrompt: string,
  config: PlanGeneratorConfig
): Promise<Plan> {
  const generator = new PlanGenerator(config);
  return generator.generate(userPrompt);
}
