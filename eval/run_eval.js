// Two questions this answers that "it worked when I tried it" cannot:
//   1. Consistency  -- does the SAME resume/JD get the SAME score every
//      time, or does it drift run to run? (LLM sampling means it can.)
//   2. Fairness      -- does changing only a candidate's name and college
//      prestige, with identical experience, change the score? It shouldn't.
//
// Needs a live ANTHROPIC_API_KEY (this calls the real analyze() pipeline,
// including the real model, same as the app). Run with: npm run eval
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { analyze } = require('../lib/analyzer');
const { buildJD } = require('../lib/jd');
const { getConfig } = require('../lib/config');

const RUNS_PER_CASE = 5;
const CASES_PATH = path.join(__dirname, 'cases.json');
const REPORT_PATH = path.join(__dirname, 'report.md');

function mean(nums) {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function stdev(nums) {
  const m = mean(nums);
  return Math.sqrt(mean(nums.map((n) => (n - m) ** 2)));
}

async function runConsistency(cfg, cases) {
  const rows = [];
  for (const c of cases) {
    const jd = buildJD({ jdText: c.jd }, cfg);
    console.log(`[consistency] ${c.id}: running ${RUNS_PER_CASE}x...`);
    const scores = [];
    for (let i = 0; i < RUNS_PER_CASE; i += 1) {
      const result = await analyze({ resumeText: c.resume, jd });
      scores.push(result.overall_score);
    }
    rows.push({
      id: c.id,
      scores,
      min: Math.min(...scores),
      max: Math.max(...scores),
      mean: Math.round(mean(scores) * 10) / 10,
      stdev: Math.round(stdev(scores) * 10) / 10,
    });
  }
  return rows;
}

async function runFairness(cfg, pairs) {
  const rows = [];
  for (const p of pairs) {
    const jd = buildJD({ jdText: p.jd }, cfg);
    console.log(`[fairness] ${p.id}: running both versions...`);
    const [a, b] = await Promise.all([
      analyze({ resumeText: p.resume_a, jd }),
      analyze({ resumeText: p.resume_b, jd }),
    ]);
    rows.push({
      id: p.id,
      note: p.note,
      score_a: a.overall_score,
      score_b: b.overall_score,
      diff: Math.abs(a.overall_score - b.overall_score),
    });
  }
  return rows;
}

function writeReport(consistency, fairness) {
  const lines = [
    '# Evaluation report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Score consistency',
    '',
    `Each case was analyzed ${RUNS_PER_CASE} times with identical input. A well-behaved`,
    'system should show a small standard deviation -- large swings mean the score',
    "depends on sampling luck as much as on the resume's actual content.",
    '',
    '| Case | Scores | Mean | Std dev | Range |',
    '|---|---|---|---|---|',
    ...consistency.map((r) => `| ${r.id} | ${r.scores.join(', ')} | ${r.mean} | ${r.stdev} | ${r.max - r.min} |`),
    '',
    '## Fairness (identical experience, different name/college)',
    '',
    '| Case | Score A | Score B | Diff | Note |',
    '|---|---|---|---|---|',
    ...fairness.map((r) => `| ${r.id} | ${r.score_a} | ${r.score_b} | ${r.diff} | ${r.note} |`),
    '',
    'A diff of 0 is the goal. Any nonzero diff here, on resumes with identical',
    'claimed experience, is worth investigating -- it means something other than',
    'qualifications is moving the score.',
  ];
  fs.writeFileSync(REPORT_PATH, lines.join('\n'));
}

async function main() {
  const cfg = getConfig();
  if (!cfg.hasCredentials) {
    console.error('No API key set for the selected LLM_PROVIDER. Copy .env.example to .env and configure it before running the eval.');
    process.exit(1);
  }
  const cases = JSON.parse(fs.readFileSync(CASES_PATH, 'utf8'));

  const consistency = await runConsistency(cfg, cases.consistency_cases);
  const fairness = await runFairness(cfg, cases.fairness_pairs);

  writeReport(consistency, fairness);
  console.log(`\nDone. Report written to ${REPORT_PATH}`);
  consistency.forEach((r) => console.log(`  consistency ${r.id}: mean=${r.mean} stdev=${r.stdev} range=${r.max - r.min}`));
  fairness.forEach((r) => console.log(`  fairness ${r.id}: diff=${r.diff}`));
}

main().catch((e) => {
  console.error('Eval run failed:', e.message);
  process.exit(1);
});
