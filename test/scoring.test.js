const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeScore, verdictFor } = require('../lib/scoring');

const PASS_CHECKS = [
  { name: 'contact_info', status: 'pass' },
  { name: 'section_structure', status: 'pass' },
  { name: 'resume_length', status: 'pass' },
  { name: 'quantifiable_impact', status: 'pass' },
  { name: 'action_verb_usage', status: 'pass' },
  { name: 'role_relevance', status: 'pass' },
];

test('full skill coverage and all-pass checks score 100', () => {
  const score = computeScore({ checks: PASS_CHECKS, verified: 5, missing: 0, unverified: 0 });
  assert.equal(score.overall, 100);
});

test('zero verified skills and all-fail checks score 0', () => {
  const failChecks = PASS_CHECKS.map((c) => ({ ...c, status: 'fail' }));
  const score = computeScore({ checks: failChecks, verified: 0, missing: 5, unverified: 0 });
  assert.equal(score.overall, 0);
});

test('unverified model claims count the same as missing, not as matched', () => {
  const a = computeScore({ checks: PASS_CHECKS, verified: 2, missing: 0, unverified: 3 });
  const b = computeScore({ checks: PASS_CHECKS, verified: 2, missing: 3, unverified: 0 });
  assert.equal(a.overall, b.overall);
});

test('verdict thresholds match the documented bands', () => {
  assert.equal(verdictFor(90), 'SHORTLIST-READY');
  assert.equal(verdictFor(75), 'SHORTLIST-READY');
  assert.equal(verdictFor(74), 'NEEDS REVISION');
  assert.equal(verdictFor(50), 'NEEDS REVISION');
  assert.equal(verdictFor(49), 'HIGH RISK');
});

test('scoring is deterministic given the same inputs', () => {
  const a = computeScore({ checks: PASS_CHECKS, verified: 3, missing: 2, unverified: 1 });
  const b = computeScore({ checks: PASS_CHECKS, verified: 3, missing: 2, unverified: 1 });
  assert.deepEqual(a, b);
});
