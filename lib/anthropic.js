const { getConfig } = require('./config');
const { HttpError } = require('./errors');

const API_URL = 'https://api.anthropic.com/v1/messages';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One place that talks to the model API: timeout, retries with backoff for
// rate limits and server errors, and logs that never contain resume text.
async function callAnthropic({ system, messages, tools, toolChoice }) {
  const cfg = getConfig();
  if (!cfg.apiKey) {
    throw new HttpError(500, 'Server is missing ANTHROPIC_API_KEY. Copy .env.example to .env and add your key.');
  }

  const body = { model: cfg.model, max_tokens: cfg.maxTokens, system, messages, tools, tool_choice: toolChoice };
  if (cfg.temperature !== null) body.temperature = cfg.temperature;

  let lastError;
  for (let attempt = 0; attempt <= cfg.retries; attempt += 1) {
    const started = Date.now();
    let retryable = false;
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(cfg.timeoutMs),
      });
      if (res.ok) return { data: await res.json(), latencyMs: Date.now() - started };

      retryable = res.status === 429 || res.status >= 500;
      lastError = new HttpError(502, `Model API error (${res.status}). Check your API key and model name.`);
      console.error(`[anthropic] status=${res.status} attempt=${attempt + 1}`);
    } catch (e) {
      retryable = true;
      lastError = new HttpError(
        502,
        e.name === 'TimeoutError' ? 'The model took too long to respond. Please try again.' : 'Could not reach the model API.'
      );
      console.error(`[anthropic] ${e.name} attempt=${attempt + 1}`);
    }
    if (!retryable || attempt === cfg.retries) break;
    await sleep(500 * 2 ** attempt);
  }
  throw lastError;
}

module.exports = { callAnthropic };
