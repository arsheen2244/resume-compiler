const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runChecks } = require('../lib/checks');

const GOOD_RESUME = `Jane Doe
jane@example.com | +1 555 123 4567 | linkedin.com/in/janedoe

Education
B.Tech Computer Science, XYZ University, 2026

Skills
Python, SQL, FastAPI, Docker, Git

Experience
- Built a REST API serving 10k requests/day, cutting p99 latency by 35%
- Led a 4-person team to ship a feature two weeks ahead of schedule
- Automated the deployment pipeline, reducing release time from 2 hours to 15 minutes
`;

test('a well-formed resume passes contact, section, and length checks', () => {
  const checks = runChecks(GOOD_RESUME);
  const byName = Object.fromEntries(checks.map((c) => [c.name, c]));
  assert.equal(byName.contact_info.status, 'pass');
  assert.equal(byName.section_structure.status, 'pass');
  assert.equal(byName.quantifiable_impact.status, 'pass');
  assert.equal(byName.action_verb_usage.status, 'pass');
});

test('a resume with no contact info fails that check', () => {
  const checks = runChecks('Skills\nPython, SQL\n\nExperience\n- Did some stuff');
  const contact = checks.find((c) => c.name === 'contact_info');
  assert.equal(contact.status, 'fail');
});

test('an empty-ish resume is flagged as too short', () => {
  const checks = runChecks('Skills\nPython');
  const length = checks.find((c) => c.name === 'resume_length');
  assert.equal(length.status, 'fail');
});

test('checks are deterministic: same input, same output, twice', () => {
  assert.deepEqual(runChecks(GOOD_RESUME), runChecks(GOOD_RESUME));
});
