const { getConfig } = require('./config');
const { HttpError } = require('./errors');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Translate the Anthropic-style request the analyzer builds into an
// OpenAI-style chat/completions body.
function toOpenAIBody({ system, messages, tools, toolChoice }, cfg) {
  const body = {
    model: cfg.openaiModel,
    max_tokens: cfg.maxTokens,
    messages: [{ role: 'system', content: system }, ...messages],
  };
  if (tools && tools.length) {
    body.tools = tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }));
    if (toolChoice && toolChoice.name) {
      body.tool_choice = { type: 'function', function: { name: toolChoice.name } };
    }
  }
  if (cfg.temperature !== null) body.temperature = cfg.temperature;
  return body;
}

function parseJsonLoose(text) {
  if (typeof text !== 'string') return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Translate the response back into the Anthropic shape so analyzer.js stays
// provider-agnostic. Small open models often ignore a forced tool call and
// answer in plain content instead, so we fall back to parsing that as JSON;
// the result still goes through validateAnalysis and evidence checking.
function toAnthropicShape(json, toolName) {
  const choice = json.choices && json.choices[0];
  const msg = (choice && choice.message) || {};
  const content = [];

  const call = (msg.tool_calls || []).find((c) => c.function && c.function.name === toolName) || (msg.tool_calls || [])[0];
  let input = null;
  if (call && call.function) {
    input = typeof call.function.arguments === 'string' ? parseJsonLoose(call.function.arguments) : call.function.arguments;
  }
  if (!input) input = parseJsonLoose(msg.content);
  if (input) content.push({ type: 'tool_use', name: toolName, input });

  return {
    model: json.model,
    stop_reason: choice && choice.finish_reason === 'length' ? 'max_tokens' : 'tool_use',
    content,
    usage: { input_tokens: json.usage?.prompt_tokens || 0, output_tokens: json.usage?.completion_tokens || 0 },
  };
}

async function callOpenAICompat(req) {
  const cfg = getConfig();
  if (!cfg.hasCredentials) {
    throw new HttpError(500, 'Server is missing OPENAI_API_KEY for the configured OPENAI_BASE_URL. See .env.example.');
  }
  const body = toOpenAIBody(req, cfg);
  const toolName = req.toolChoice && req.toolChoice.name;
  const headers = { 'Content-Type': 'application/json' };
  if (cfg.openaiApiKey) headers.Authorization = `Bearer ${cfg.openaiApiKey}`;

  let lastError;
  for (let attempt = 0; attempt <= cfg.retries; attempt += 1) {
    const started = Date.now();
    let retryable = false;
    try {
      const res = await fetch(`${cfg.openaiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(cfg.timeoutMs),
      });
      if (res.ok) return { data: toAnthropicShape(await res.json(), toolName), latencyMs: Date.now() - started };

      retryable = res.status === 429 || res.status >= 500;
      lastError = new HttpError(502, `Model API error (${res.status}). Check OPENAI_BASE_URL, key and model name.`);
      console.error(`[openai-compat] status=${res.status} attempt=${attempt + 1}`);
    } catch (e) {
      retryable = true;
      lastError = new HttpError(
        502,
        e.name === 'TimeoutError'
          ? 'The model took too long to respond. Local models can be slow; raise REQUEST_TIMEOUT_MS.'
          : 'Could not reach the model API. Is Ollama running / is OPENAI_BASE_URL correct?'
      );
      console.error(`[openai-compat] ${e.name} attempt=${attempt + 1}`);
    }
    if (!retryable || attempt === cfg.retries) break;
    await sleep(500 * 2 ** attempt);
  }
  throw lastError;
}

module.exports = { callOpenAICompat, toOpenAIBody, toAnthropicShape };
