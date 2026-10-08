const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verifyEvidence } = require('../lib/evidence');

const RESUME = 'Built a REST API serving 10,000 requests per day using FastAPI and PostgreSQL.';

test('an exact quote from the resume verifies', () => {
  assert.equal(verifyEvidence(RESUME, 'Built a REST API serving 10,000 requests per day'), true);
});

test('a quote with different case and punctuation still verifies (normalized match)', () => {
  assert.equal(verifyEvidence(RESUME, 'built a rest api serving 10000 requests per day'), true);
});

test('a fabricated quote not present in the resume fails', () => {
  assert.equal(verifyEvidence(RESUME, 'Led a team of twenty engineers across three continents'), false);
});

test('a non-string quote fails safely instead of throwing', () => {
  assert.equal(verifyEvidence(RESUME, null), false);
  assert.equal(verifyEvidence(RESUME, undefined), false);
});
