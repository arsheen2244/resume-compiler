// The overall score is computed here, in code, from a fixed formula.
// The model never outputs the number, so a manipulated model cannot set it.

const COMPONENTS = [
  { key: 'skill_coverage', label: 'Skill coverage', max: 40 },
  { key: 'role_relevance', label: 'Role relevance', max: 20 },
  { key: 'contact_info', label: 'Contact info', max: 10 },
  { key: 'section_structure', label: 'Section structure', max: 10 },
  { key: 'quantifiable_impact', label: 'Quantifiable impact', max: 10 },
  { key: 'action_verb_usage', label: 'Action verbs', max: 5 },
  { key: 'resume_length', label: 'Resume length', max: 5 },
];

const STATUS_POINTS = { pass: 1, warn: 0.5, fail: 0 };
const round1 = (n) => Math.round(n * 10) / 10;

function verdictFor(score) {
  if (score >= 75) return 'SHORTLIST-READY';
  if (score >= 50) return 'NEEDS REVISION';
  return 'HIGH RISK';
}

// verified   = job requirements the resume proves with a checked quote
// missing    = requirements the model found no evidence for
// unverified = matches the model claimed but could not quote (counted as missing)
function computeScore({ checks, verified, missing, unverified }) {
  const byName = Object.fromEntries(checks.map((c) => [c.name, c]));
  const total = verified + missing + unverified;
  const ratio = total > 0 ? verified / total : 0;

  const breakdown = COMPONENTS.map((c) => {
    const r = c.key === 'skill_coverage' ? ratio : STATUS_POINTS[byName[c.key]?.status] ?? 0;
    return { component: c.key, label: c.label, earned: round1(r * c.max), max: c.max };
  });

  const overall = Math.round(breakdown.reduce((sum, b) => sum + b.earned, 0));
  return {
    overall,
    verdict: verdictFor(overall),
    breakdown,
    coverage: { verified, missing, unverified, total, ratio: round1(ratio * 100) },
  };
}

function buildReason({ breakdown, coverage }) {
  const parts = [];
  if (coverage.total > 0) {
    parts.push(`${coverage.verified} of ${coverage.total} job requirements are backed by evidence in your resume.`);
  } else {
    parts.push('No job requirements could be assessed.');
  }
  const gaps = breakdown
    .filter((b) => b.earned < b.max)
    .sort((a, b) => b.max - b.earned - (a.max - a.earned));
  if (gaps.length > 0) {
    const g = gaps[0];
    parts.push(`Biggest gap: ${g.label.toLowerCase()} (${g.earned} of ${g.max} points).`);
  } else {
    parts.push('No gaps found in any scored area.');
  }
  return parts.join(' ');
}

module.exports = { COMPONENTS, computeScore, buildReason, verdictFor };
