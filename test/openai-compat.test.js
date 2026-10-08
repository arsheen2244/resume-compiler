const test = require('node:test');
const assert = require('node:assert');
const { toOpenAIBody, toAnthropicShape } = require('../lib/openai-compat');
const { ANALYSIS_TOOL } = require('../lib/schema');

const cfg = { openaiModel: 'm', maxTokens: 100, temperature: null };
const req = {
  system: 'sys',
  messages: [{ role: 'user', content: 'hi' }],
  tools: [ANALYSIS_TOOL],
  toolChoice: { type: 'tool', name: ANALYSIS_TOOL.name },
};

test('request is translated to OpenAI chat format', () => {
  const body = toOpenAIBody(req, cfg);
  assert.strictEqual(body.messages[0].role, 'system');
  assert.strictEqual(body.tools[0].function.name, 'submit_analysis');
  assert.deepStrictEqual(body.tools[0].function.parameters, ANALYSIS_TOOL.input_schema);
  assert.deepStrictEqual(body.tool_choice, { type: 'function', function: { name: 'submit_analysis' } });
  assert.ok(!('temperature' in body));
});

test('tool_call response becomes an Anthropic-style tool_use block', () => {
  const out = toAnthropicShape(
    {
      model: 'm',
      usage: { prompt_tokens: 5, completion_tokens: 7 },
      choices: [{ finish_reason: 'tool_calls', message: { tool_calls: [{ function: { name: 'submit_analysis', arguments: '{"a":1}' } }] } }],
    },
    'submit_analysis'
  );
  assert.deepStrictEqual(out.content[0], { type: 'tool_use', name: 'submit_analysis', input: { a: 1 } });
  assert.strictEqual(out.usage.input_tokens, 5);
});

test('falls back to JSON in plain content (fenced) when no tool call is made', () => {
  const out = toAnthropicShape(
    { choices: [{ finish_reason: 'stop', message: { content: 'Here:\n```json\n{"a":2}\n```' } }] },
    'submit_analysis'
  );
  assert.deepStrictEqual(out.content[0].input, { a: 2 });
});

test('unparseable output yields no tool_use; length maps to max_tokens', () => {
  const bad = toAnthropicShape({ choices: [{ finish_reason: 'stop', message: { content: 'sorry' } }] }, 'submit_analysis');
  assert.strictEqual(bad.content.length, 0);
  const cut = toAnthropicShape({ choices: [{ finish_reason: 'length', message: { content: '{' } }] }, 'submit_analysis');
  assert.strictEqual(cut.stop_reason, 'max_tokens');
});
