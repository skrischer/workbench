// examples/session-summary-example.ts — Example usage of summarizeSession

import { summarizeSession } from '../src/memory/session-summarizer.js';
import type { SessionSummaryInput } from '../src/types/index.js';

/**
 * Example: Summarize an agent session
 * 
 * This demonstrates how to use the summarizeSession() function
 * to generate structured summaries from agent session data.
 */
async function exampleUsage() {
  // Create sample session input
  const input: SessionSummaryInput = {
    sessionId: 'session-2024-03-09-001',
    runId: 'run-abc123',
    messages: [
      {
        role: 'user',
        content: 'Please analyze the codebase and identify potential performance issues.',
        timestamp: new Date('2024-03-09T10:00:00Z').toISOString(),
      },
      {
        role: 'assistant',
        content: 'I will analyze the codebase for performance issues. Let me start by reading the main files.',
        timestamp: new Date('2024-03-09T10:00:05Z').toISOString(),
      },
      {
        role: 'tool',
        content: 'Read file: src/main.ts (1234 lines)',
        timestamp: new Date('2024-03-09T10:00:10Z').toISOString(),
      },
      {
        role: 'assistant',
        content: 'I found several performance issues: 1) Unnecessary re-renders in components, 2) Inefficient database queries, 3) Memory leaks in event listeners.',
        timestamp: new Date('2024-03-09T10:01:00Z').toISOString(),
      },
      {
        role: 'user',
        content: 'Can you fix the memory leaks?',
        timestamp: new Date('2024-03-09T10:01:30Z').toISOString(),
      },
      {
        role: 'assistant',
        content: 'I will fix the memory leaks by adding proper cleanup in useEffect hooks.',
        timestamp: new Date('2024-03-09T10:01:35Z').toISOString(),
      },
      {
        role: 'tool',
        content: 'Modified file: src/components/Dashboard.tsx',
        timestamp: new Date('2024-03-09T10:02:00Z').toISOString(),
      },
      {
        role: 'assistant',
        content: 'Memory leaks have been fixed. All event listeners now have proper cleanup functions.',
        timestamp: new Date('2024-03-09T10:02:30Z').toISOString(),
      },
    ],
    runMetadata: {
      id: 'run-abc123',
      startedAt: new Date('2024-03-09T10:00:00Z').toISOString(),
      endedAt: new Date('2024-03-09T10:02:30Z').toISOString(),
      status: 'completed',
      prompt: 'Analyze and fix performance issues',
      tokenUsage: {
        inputTokens: 1500,
        outputTokens: 800,
        totalTokens: 2300,
      },
    },
    filesModified: [
      'src/components/Dashboard.tsx',
      'src/hooks/useEventListener.ts',
    ],
  };

  try {
    // Generate summary
    console.log('Generating session summary...');
    const summary = await summarizeSession(input);

    // Display results
    console.log('\n📋 Session Summary:');
    console.log('==================');
    console.log(summary.summary);
    
    console.log('\n🔑 Key Decisions:');
    summary.keyDecisions.forEach((decision, idx) => {
      console.log(`  ${idx + 1}. ${decision}`);
    });
    
    console.log('\n❌ Errors:');
    if (summary.errors.length === 0) {
      console.log('  None');
    } else {
      summary.errors.forEach((error, idx) => {
        console.log(`  ${idx + 1}. ${error}`);
      });
    }
    
    console.log('\n💡 Learnings:');
    summary.learnings.forEach((learning, idx) => {
      console.log(`  ${idx + 1}. ${learning}`);
    });
    
    console.log('\n📁 Related Files:');
    summary.relatedFiles.forEach(file => {
      console.log(`  - ${file}`);
    });
    
    console.log('\n📊 Metadata:');
    console.log(`  Status: ${summary.metadata.status}`);
    console.log(`  Duration: ${Math.round(summary.metadata.duration / 1000)}s`);
    console.log(`  Tokens: ${summary.metadata.tokenUsage.totalTokens} (input: ${summary.metadata.tokenUsage.inputTokens}, output: ${summary.metadata.tokenUsage.outputTokens})`);
    console.log(`  Timestamp: ${summary.metadata.timestamp}`);

  } catch (error) {
    console.error('Failed to generate summary:', error);
    throw error;
  }
}

// Run example if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  exampleUsage()
    .then(() => {
      console.log('\n✅ Example completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Example failed:', error);
      process.exit(1);
    });
}

export { exampleUsage };
