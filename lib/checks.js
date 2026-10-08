// Deterministic resume checks. Plain code, no model: the same resume always
// gets the same result, and every result can be explained line by line.

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_CANDIDATE_RE = /\+?\d[\d\s().-]{8,}\d/g;
const LINK_RE = /linkedin\.com|github\.com/i;
const BULLET_RE = /^\s*(?:[\u2022\u25CF\u25AA\u25E6\u00B7\uF0B7\uF0A7*>\-\u2013\u2014]|\d+[.)])\s+/;

const ACTION_VERBS = new Set([
  'built', 'led', 'wrote', 'ran', 'drove', 'made', 'won', 'began', 'ship', 'shipped',
  'spearheaded', 'architected', 'owned', 'taught', 'trained', 'mentored', 'set', 'cut',
  'grew', 'saved', 'reduced', 'increased', 'improved', 'launched', 'created', 'developed',
  'designed', 'implemented', 'deployed', 'automated', 'optimized', 'engineered',
  'integrated', 'migrated', 'refactored', 'analyzed', 'evaluated', 'delivered',
  'managed', 'organized', 'coordinated', 'collaborated', 'researched', 'tested',
  'debugged', 'fixed', 'documented', 'containerized', 'configured', 'trained',
]);

function words(text) {
  return (text.match(/\S+/g) || []).length;
}

function findPhone(text) {
  const matches = text.match(PHONE_CANDIDATE_RE) || [];
  return matches.some((m) => {
    const digits = m.replace(/\D/g, '').length;
    return digits >= 10 && digits <= 13;
  });
}

function getStatements(text) {
  const lines = text.split('\n');
  const bullets = lines.filter((l) => BULLET_RE.test(l)).map((l) => l.replace(BULLET_RE, '').trim());
  if (bullets.length > 0) return { items: bullets, hasBullets: true };
  return {
    items: lines.map((l) => l.trim()).filter((l) => words(l) >= 6),
    hasBullets: false,
  };
}

function checkContact(text) {
  const email = EMAIL_RE.test(text);
  const phone = findPhone(text);
  const link = LINK_RE.test(text);
  const missing = [!email && 'email', !phone && 'phone number'].filter(Boolean);
  let status = 'pass';
  if (missing.length === 1) status = 'warn';
  if (missing.length === 2) status = 'fail';
  const detail =
    missing.length === 0
      ? `Email and phone found${link ? ', plus a LinkedIn/GitHub link' : ''}`
      : `Missing: ${missing.join(' and ')}`;
  return { id: 'CT-01', name: 'contact_info', status, detail };
}

const SECTION_GROUPS = [
  { key: 'education', re: /^(education|academics?|academic (background|qualifications?))$/ },
  { key: 'skills', re: /^((technical |core |key )?skills|technologies|tech stack|skills (and|&) tools?)$/ },
  {
    key: 'experience or projects',
    re: /^((work |professional )?experience|internships?|projects?|(personal|academic|key) projects|work history|employment)$/,
  },
];

function checkSections(text) {
  const headers = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l.length <= 40)
    .map((l) => l.toLowerCase().replace(/[^a-z& ]/g, '').replace(/\s+/g, ' ').trim());
  const found = SECTION_GROUPS.filter((g) => headers.some((h) => g.re.test(h)));
  const missing = SECTION_GROUPS.filter((g) => !found.includes(g)).map((g) => g.key);
  let status = 'fail';
  if (found.length === 3) status = 'pass';
  else if (found.length === 2) status = 'warn';
  const detail = missing.length === 0 ? 'Education, skills and experience/projects headers found' : `Missing header: ${missing.join(', ')}`;
  return { id: 'ST-02', name: 'section_structure', status, detail };
}

function checkLength(text) {
  const n = words(text);
  let status = 'pass';
  if (n < 150 || n > 1200) status = 'fail';
  else if (n < 250 || n > 900) status = 'warn';
  const guide = 'aim for 250-900 words';
  return { id: 'LN-03', name: 'resume_length', status, detail: `${n} words (${guide})` };
}

function hasMetric(line) {
  const noYears = line.replace(/\b(19|20)\d{2}\b/g, ' ');
  return /\d/.test(noYears);
}

function checkQuantifiable(text) {
  const { items } = getStatements(text);
  const withNumbers = items.filter(hasMetric).length;
  let status = 'fail';
  if (withNumbers >= 3) status = 'pass';
  else if (withNumbers >= 1) status = 'warn';
  const detail = `${withNumbers} of ${items.length} statements include a number or metric`;
  return { id: 'QT-04', name: 'quantifiable_impact', status, detail };
}

function startsWithActionVerb(statement) {
  const first = (statement.split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!first) return false;
  return ACTION_VERBS.has(first) || (first.length > 4 && first.endsWith('ed'));
}

function checkActionVerbs(text) {
  const { items, hasBullets } = getStatements(text);
  if (!hasBullets) {
    return {
      id: 'AV-05',
      name: 'action_verb_usage',
      status: 'warn',
      detail: 'No bullet points detected; use bullets that start with action verbs',
    };
  }
  const good = items.filter(startsWithActionVerb).length;
  const ratio = items.length ? good / items.length : 0;
  let status = 'fail';
  if (ratio >= 0.6) status = 'pass';
  else if (ratio >= 0.3) status = 'warn';
  return {
    id: 'AV-05',
    name: 'action_verb_usage',
    status,
    detail: `${good} of ${items.length} bullets start with an action verb`,
  };
}

function runChecks(text) {
  return [
    checkContact(text),
    checkSections(text),
    checkLength(text),
    checkQuantifiable(text),
    checkActionVerbs(text),
  ];
}

module.exports = { runChecks, getStatements, startsWithActionVerb };
