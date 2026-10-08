// Read at call time (not import time) so dotenv can load first and tests can
// change process.env between runs.
function num(value, fallback) {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getConfig() {
  const env = process.env;
  // LLM_PROVIDER: "anthropic" (default) or "openai" (any OpenAI-compatible
  // endpoint: Ollama, Groq, OpenRouter, ...).
  const provider = (env.LLM_PROVIDER || 'anthropic').toLowerCase();
  const openaiApiKey = env.OPENAI_API_KEY || '';
  const openaiBaseUrl = (env.OPENAI_BASE_URL || 'http://localhost:11434/v1').replace(/\/+$/, '');
  const openaiModel = env.OPENAI_MODEL || 'qwen2.5:7b';
  const anthropicKey = env.ANTHROPIC_API_KEY || '';
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(openaiBaseUrl);
  return {
    provider,
    apiKey: anthropicKey,
    model: env.ANTHROPIC_MODEL || 'claude-sonnet-5',
    openaiApiKey,
    openaiBaseUrl,
    openaiModel,
    // Name of the model actually in use, whichever provider is selected.
    activeModel: provider === 'openai' ? openaiModel : env.ANTHROPIC_MODEL || 'claude-sonnet-5',
    // Local servers (Ollama) need no key; hosted ones do.
    hasCredentials: provider === 'openai' ? Boolean(openaiApiKey) || isLocal : Boolean(anthropicKey),
    maxTokens: num(env.MAX_OUTPUT_TOKENS, 2000),
    // Opt-in: some newer models reject sampling parameters, so we only send
    // temperature when you explicitly set it in .env.
    temperature: num(env.ANTHROPIC_TEMPERATURE, null),
    timeoutMs: num(env.REQUEST_TIMEOUT_MS, 45000),
    retries: num(env.API_RETRIES, 2),
    port: num(env.PORT, 3000),
    rateLimitPer15Min: num(env.RATE_LIMIT_PER_15MIN, 20),
    dailyBudget: num(env.MAX_DAILY_REQUESTS, 500),
    trustProxy: env.TRUST_PROXY || '',
    limits: {
      resumeChars: 20000,
      jdChars: 15000,
      minResumeChars: 100,
      minJdChars: 40,
      roleTitleChars: 80,
      pdfBytes: 5 * 1024 * 1024,
    },
  };
}

module.exports = { getConfig };
