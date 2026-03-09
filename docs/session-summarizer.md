# Session Summarizer

LLM-basierte Zusammenfassung von Agent-Sessions mit strukturierter Extraktion von Key Decisions, Errors und Learnings.

## Überblick

Die `summarizeSession()` Funktion analysiert Agent-Session-Verläufe und generiert strukturierte Zusammenfassungen mithilfe von Claude Haiku 4. Sie extrahiert automatisch wichtige Entscheidungen, aufgetretene Fehler und gewonnene Erkenntnisse aus der Message-History.

## Features

- **Strukturierte Ausgabe**: JSON-basierte Zusammenfassung mit klaren Kategorien
- **LLM-basierte Analyse**: Nutzt Claude Haiku 4 für kosten-effiziente Summarization
- **Intelligenter Fallback**: Bei LLM-Fehler wird eine Basic Summary aus Metadaten generiert
- **Performance-Optimierung**: Limitiert Input auf letzte 50 Messages
- **Type-Safe**: Vollständig typisierte TypeScript-API

## Installation

```bash
npm install @skrischer/workbench
```

## Verwendung

### Basic Usage

```typescript
import { summarizeSession } from '@skrischer/workbench/memory';
import type { SessionSummaryInput } from '@skrischer/workbench/types';

const input: SessionSummaryInput = {
  sessionId: 'session-123',
  runId: 'run-456',
  messages: [
    { role: 'user', content: 'Build a feature', timestamp: '...' },
    { role: 'assistant', content: 'I will implement it', timestamp: '...' },
    // ... more messages
  ],
  runMetadata: {
    id: 'run-456',
    startedAt: '2024-03-09T10:00:00Z',
    endedAt: '2024-03-09T10:30:00Z',
    status: 'completed',
    prompt: 'Build feature X',
    tokenUsage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 }
  },
  filesModified: ['src/feature.ts', 'src/tests/feature.test.ts']
};

const summary = await summarizeSession(input);

console.log(summary.summary);
console.log('Key Decisions:', summary.keyDecisions);
console.log('Errors:', summary.errors);
console.log('Learnings:', summary.learnings);
```

### Output Structure

```typescript
interface SessionSummary {
  sessionId: string;
  runId: string;
  summary: string;              // Gesamtzusammenfassung
  keyDecisions: string[];       // Wichtige Entscheidungen
  errors: string[];             // Aufgetretene Fehler + Lösungen
  learnings: string[];          // Gewonnene Erkenntnisse
  relatedFiles: string[];       // Geänderte/relevante Dateien
  metadata: {
    tokenUsage: TokenUsage;     // Token-Verbrauch
    status: RunStatus;          // Status (completed, failed, etc.)
    duration: number;           // Laufzeit in Millisekunden
    timestamp: string;          // Generierungs-Timestamp
  };
}
```

### Error Handling

Die Funktion wirft einen Fehler bei ungültigen Inputs:

```typescript
try {
  const summary = await summarizeSession(input);
} catch (error) {
  if (error.message.includes('Invalid sessionId')) {
    console.error('Session ID muss ein nicht-leerer String sein');
  } else if (error.message.includes('Invalid runId')) {
    console.error('Run ID muss ein nicht-leerer String sein');
  } else {
    console.error('Unerwarteter Fehler:', error);
  }
}
```

Bei LLM-Fehler wird automatisch ein Fallback verwendet, daher wirft die Funktion in diesem Fall **keinen** Fehler.

### Fallback-Verhalten

Wenn die LLM-basierte Summarization fehlschlägt (z.B. durch API-Fehler, Rate Limits oder Parsing-Probleme), generiert die Funktion automatisch eine Basic Summary aus den verfügbaren Metadaten:

```typescript
// Fallback-Summary-Beispiel
{
  summary: "Session with 25 messages involving user, assistant, tool. 5 tool calls were made. Modified files: src/main.ts, src/utils.ts. Context: Implement authentication system...",
  keyDecisions: [],
  errors: [],
  learnings: [],
  relatedFiles: ['src/main.ts', 'src/utils.ts']
}
```

## Implementation Details

### LLM Model

- **Model**: `anthropic/claude-haiku-4`
- **Max Tokens**: 2048
- **Reasoning**: Kosten-effizient für Summarization-Tasks

### Message Limit

Um Performance und Kosten zu optimieren, werden nur die **letzten 50 Messages** für die Summarization verwendet. Bei längeren Sessions wird also nur das Ende der Conversation analysiert.

### Prompt Engineering

Die Funktion nutzt einen strukturierten System-Prompt, der das LLM anweist, folgende Informationen zu extrahieren:

1. **Summary**: Überblick über was erreicht wurde
2. **Key Decisions**: Wichtige Entscheidungen die getroffen wurden
3. **Errors**: Aufgetretene Probleme und deren Lösungen
4. **Learnings**: Wichtige Erkenntnisse für zukünftige Sessions

Der User-Prompt enthält:
- Session-Kontext (Run ID, Status, Duration)
- Geänderte Dateien
- Message-History (formatiert mit Timestamps und Rollen)

### Authentication

Die Funktion nutzt den Anthropic OAuth Client mit automatischem Token-Refresh. Token werden in `~/.workbench/tokens.json` gespeichert.

## Testing

### Unit Tests

```bash
npm test -- src/memory/__tests__/summarize-session.test.ts
```

Die Tests decken ab:
- Input Validation
- Erfolgreiche Summarization mit Mock LLM
- Fallback bei LLM-Fehler
- JSON-Parsing aus LLM-Response
- Edge Cases (fehlende Felder, leere Arrays, etc.)

### Integration Test

Ein vollständiges Beispiel findest du in `examples/session-summary-example.ts`:

```bash
npx tsx examples/session-summary-example.ts
```

## Performance

- **Latency**: Ca. 2-5 Sekunden (abhängig von Message-Count und API-Latency)
- **Token Usage**: Ca. 500-1500 Input-Tokens, 100-300 Output-Tokens
- **Cost**: ~$0.0001-0.0005 pro Summarization (mit Claude Haiku 4)

## Roadmap

- [ ] Streaming-Support für Echtzeit-Summarization
- [ ] Konfigurierbare Message-Limit
- [ ] Multi-Language Support für Summaries
- [ ] Semantic Clustering von ähnlichen Sessions
- [ ] Custom Prompt Templates

## Siehe auch

- [Memory System Overview](./memory-system.md)
- [LanceDB Integration](./lancedb-store.md)
- [Anthropic OAuth Client](../anthropic-oauth-provider.md)
