const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildJD } = require('../lib/jd');
const { getConfig } = require('../lib/config');

const cfg = getConfig();

test('a pasted JD is used as-is with high confidence', () => {
  const jd = buildJD({ jdText: 'We need a backend engineer with 3+ years of Python and SQL experience.' }, cfg);
  assert.equal(jd.confidence, 'high');
  assert.ok(jd.text.includes('backend engineer'));
});

test('a known role title with no JD uses the curated profile at medium confidence', () => {
  const jd = buildJD({ jdText: '', roleTitle: 'GenAI Engineer' }, cfg);
  assert.equal(jd.confidence, 'medium');
  assert.ok(jd.text.includes('Must-have skills'));
});

test('role title lookup is case- and whitespace-insensitive', () => {
  const jd = buildJD({ jdText: '', roleTitle: '  genai engineer  ' }, cfg);
  assert.equal(jd.confidence, 'medium');
});

test('an unknown role title falls back to a low-confidence generated profile', () => {
  const jd = buildJD({ jdText: '', roleTitle: 'Underwater Basket Weaving Lead' }, cfg);
  assert.equal(jd.confidence, 'low');
});

test('no JD and no role title throws a clear error', () => {
  assert.throws(() => buildJD({ jdText: '', roleTitle: '' }, cfg), /at least/);
});
