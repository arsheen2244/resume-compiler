const { getConfig } = require('./config');
const { callAnthropic } = require('./anthropic');
const { callOpenAICompat } = require('./openai-compat');

// Picks the provider at call time from LLM_PROVIDER.
function callLLM(req) {
  return getConfig().provider === 'openai' ? callOpenAICompat(req) : callAnthropic(req);
}

module.exports = { callLLM };
