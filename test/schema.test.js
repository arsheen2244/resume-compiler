const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateAnalysis } = require('../lib/schema');

const VALID = {
  role_relevance: { status: 'pass', detail: 'Strong backend and API experience matches the role.' },
  matched_skills: [{ skill: 'Python', evidence: 'Built a REST API in Python' }],
  missing_skills: ['Kubernetes'],
  fixes: ['Add a metric to your top bullet point.'],
  instructions_in_documents: false,
};

test('a well-formed analysis object passes validation', () => {
  const result = validateAnalysis(VALID);
  assert.equal(result.ok, true);
});

test('an invalid status value is rejected', () => {
  const bad = { ...VALID, role_relevance: { status: 'excellent', detail: 'x' } };
  const result = validateAnalysis(bad);
  assert.equal(result.ok, false);
});

test('a matched skill missing its evidence string is rejected', () => {
  const bad = { ...VALID, matched_skills: [{ skill: 'Python' }] };
  const result = validateAnalysis(bad);
  assert.equal(result.ok, false);
});

test('missing instructions_in_documents field is rejected', () => {
  const { instructions_in_documents, ...bad } = VALID;
  const result = validateAnalysis(bad);
  assert.equal(result.ok, false);
});

test('non-object input is rejected without throwing', () => {
  assert.equal(validateAnalysis(null).ok, false);
  assert.equal(validateAnalysis('a string').ok, false);
  assert.equal(validateAnalysis([1, 2, 3]).ok, false);
});
