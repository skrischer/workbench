// Barrel export for all test fixtures
// Uses Node.js 22+ import attributes for JSON modules

// Response fixtures
import simpleTextFixture from './responses/simple-text.json' with { type: 'json' };
import toolUseReadFileFixture from './responses/tool-use-read-file.json' with { type: 'json' };
import toolUseWriteFileFixture from './responses/tool-use-write-file.json' with { type: 'json' };
import multiTurnFixture from './responses/multi-turn.json' with { type: 'json' };
import error401Fixture from './responses/error-401.json' with { type: 'json' };
import error429Fixture from './responses/error-429.json' with { type: 'json' };

// Config and token fixtures
import tokensFixture from './tokens.json' with { type: 'json' };
import agentConfigFixture from './agent-config.json' with { type: 'json' };

// Re-export with descriptive names
export const simpleText = simpleTextFixture;
export const toolUseReadFile = toolUseReadFileFixture;
export const toolUseWriteFile = toolUseWriteFileFixture;
export const multiTurn = multiTurnFixture;
export const error401 = error401Fixture;
export const error429 = error429Fixture;
export const tokens = tokensFixture;
export const agentConfig = agentConfigFixture;
