// Two jobs, both about not trusting the text we are about to send to a model:
//   1. redactPII: remove personal details the model does not need
//      (this also removes name/gender cues that could bias a score).
//   2. detectInjection: spot text that tries to give the AI orders.

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const URL_RE =
  /\b(?:https?:\/\/|www\.)\S+|\b(?:linkedin\.com|github\.com|gitlab\.com|leetcode\.com|kaggle\.com)\/\S*/gi;
const PHONE_CANDIDATE_RE = /\+?\d[\d\s().-]{8,}\d/g;

function redactPII(text) {
  const counts = { email: 0, phone: 0, url: 0, name: 0 };

  let out = text.replace(EMAIL_RE, () => {
    counts.email += 1;
    return '[EMAIL]';
  });
  out = out.replace(URL_RE, () => {
    counts.url += 1;
    return '[URL]';
  });
  out = out.replace(PHONE_CANDIDATE_RE, (match) => {
    const digits = match.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 13) {
      counts.phone += 1;
      return '[PHONE]';
    }
    return match;
  });

  // Heuristic: the first non-empty line of a resume is almost always the
  // candidate's name. Short, letters-only lines are treated as a name.
  const lines = out.split('\n');
  const idx = lines.findIndex((l) => l.trim().length > 0);
  if (idx !== -1) {
    const first = lines[idx].trim();
    const words = first.split(/\s+/);
    if (words.length <= 4 && /^[\p{L}][\p{L}.'\- ]*$/u.test(first)) {
      lines[idx] = '[NAME]';
      counts.name += 1;
    }
  }

  return { text: lines.join('\n'), counts };
}

const INJECTION_PATTERNS = [
  {
    id: 'ignore-instructions',
    re: /\b(ignore|disregard|forget)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|any)\b[^.\n]{0,40}\b(instructions?|prompts?|rules?)\b/i,
  },
  {
    id: 'role-override',
    re: /\byou are (now|no longer)\b|\bnew instructions?\s*:|\bsystem prompt\b/i,
  },
  {
    id: 'score-demand',
    re: /\b(give|assign|rate|score|mark)\b[^.\n]{0,30}\b(this|the|my)\b[^.\n]{0,20}\b(resume|candidate|application|profile)\b[^.\n]{0,30}\b(100|10\/10|perfect|highest|maximum|top)\b/i,
  },
  {
    id: 'hire-demand',
    re: /\b(shortlist|hire|select|recommend)\b[^.\n]{0,20}\b(this|the)\b[^.\n]{0,15}\bcandidate\b/i,
  },
  {
    id: 'tag-breakout',
    re: /<\/?\s*(resume|job_description|system|assistant|instructions?)\s*>/i,
  },
];

function detectInjection(text) {
  return INJECTION_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.id);
}

// Stops user text from closing our own <resume>/<job_description> wrappers.
function neutralizeTags(text) {
  return text.replace(/<\/?\s*(resume|job_description)\s*>/gi, '[tag removed]');
}

module.exports = { redactPII, detectInjection, neutralizeTags };
