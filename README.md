# Resume Compiler v2

An LLM-based tool that checks a resume against a job description, a job description PDF,
or just a role title -- and unlike a v1 wrapper-around-a-prompt, **every skill match the model
claims is verified against the actual resume text before it counts toward the score.**

This is a candidate-side tool (a person checking their own resume), not an employer-side
screener. That distinction matters: the EU AI Act classifies AI used to filter or evaluate
job applicants as high-risk (obligations postponed to 2 December 2027 under the Digital
Omnibus). This project isn't that -- but it's built with the same discipline that kind of
system would need: evidence, checks, and known limits, not a black-box score.

## What changed from v1, and why

| v1 | v2 | Why |
|---|---|---|
| Score written directly by the LLM | Score computed in code from a fixed, documented formula | A model can't set the number a system depends on -- see `lib/scoring.js` |
| "Return JSON" in the prompt | Forced tool call + schema validation + one retry | Raw-JSON prompting silently breaks on markdown fences, truncation, or a model just not complying |
| Model output → `innerHTML` | Model output → `textContent` only | Model output is untrusted text, same as any other input from outside your server |
| No defense against hidden instructions | Delimited input, injection pattern detection, evidence checks | A resume can contain text aimed at the AI reading it, not just the human |
| Full names/emails/phones sent to the model | PII redacted before the model sees it | Removes both a privacy leak and a bias vector (name-based cues) |
| No rate limit | Per-IP rate limit + daily budget | Anyone who finds the URL can otherwise run up your API bill |
| Resume/JD as pasted text only | + PDF upload (resume and JD) + role-title-only mode | Most people have a resume as a PDF, not plain text |
| No way to know if it's consistent or fair | `eval/run_eval.js`: repeated-run consistency + name/college fairness check | "It worked when I tried it" isn't evidence |

## Architecture

```
                     Browser (public/)
                            |
              POST /api/analyze  (JSON or multipart/form-data)
                            |
                        server.js
              rate limit -> daily budget -> multer (PDF, memory only)
                            |
                 lib/pdf.js (if a PDF was uploaded)
                 lib/jd.js  (pasted text | curated role profile | generated profile)
                            |
                     lib/analyzer.js
          -----------------------------------------
          |                                       |
   lib/checks.js                          lib/redact.js
   (deterministic: contact,               (strip PII + name,
    sections, length,                      detect injection attempts)
    quantifiable impact,
    action verbs)                                 |
          |                              lib/anthropic.js -> Claude
          |                              (tool-forced JSON, retries,
          |                               timeout, one repair attempt)
          |                                       |
          |                              lib/schema.js (validate shape)
          |                                       |
          |                              lib/evidence.js (verify every
          |                               claimed quote exists in the
          |                               actual resume text)
          -----------------------------------------
                            |
                     lib/scoring.js
           (score computed in code from checks + verified
            matches; the model never outputs the number)
                            |
                        server.js -> JSON response
                            |
                  public/script.js (textContent-only rendering)
```

## Setup

```bash
npm install
cp .env.example .env   # add your ANTHROPIC_API_KEY
npm start               # http://localhost:3000
```

```bash
npm test    # 38 unit + integration tests, no network or API key needed
npm run eval  # consistency + fairness report -- needs a live API key, writes eval/report.md
```

## Choosing an LLM (paid or free)

Set `LLM_PROVIDER` in `.env`:

- `anthropic` (default): Claude via the Anthropic API (paid, best quality). Needs `ANTHROPIC_API_KEY`.
- `openai`: any OpenAI-compatible endpoint, including free/open-source options:
  - **Ollama (local, free, no key):** `ollama pull qwen2.5:7b`, then `OPENAI_BASE_URL=http://localhost:11434/v1` and `OPENAI_MODEL=qwen2.5:7b`.
  - **Groq / OpenRouter (hosted free tiers):** set `OPENAI_BASE_URL`, `OPENAI_API_KEY`, and `OPENAI_MODEL`.

`lib/openai-compat.js` translates the request and response so the rest of the pipeline is
provider-agnostic. Small open models sometimes ignore the forced tool call, so the adapter
falls back to parsing JSON from plain text; output still goes through schema validation and
evidence verification, so a weaker model can't inflate the score. Expect lower-quality
matching than Claude, and run `npm run eval` per provider to compare.

## How the score is computed

The model never states a number. It returns, via a forced tool call:
`role_relevance` (pass/warn/fail + why), `matched_skills` (each with an exact quote from
the resume as evidence), `missing_skills`, and `fixes`. The server then:

1. Runs `lib/checks.js` -- five checks with **zero model involvement**: contact info, resume
   section structure, length, quantifiable-impact bullets, and action-verb usage.
2. Verifies every claimed `matched_skills` quote actually appears in the resume text
   (`lib/evidence.js`). A claim that can't be verified moves to `unverified_claims` and is
   scored as if missing -- the model gets no credit for asserting something it can't quote.
3. Computes the overall score from a fixed weighted formula (`lib/scoring.js`): skill
   coverage (40%), role relevance (20%), and the five deterministic checks (40% combined).
   The exact breakdown is returned in the response and shown in the UI, so a "72" is always
   explainable, not asserted.

## Security and reliability notes

- **API key** never reaches the browser; only `server.js` holds it (`.env`, gitignored).
- **PII redaction**: name, email, phone, and profile URLs are replaced with placeholders
  before the resume text is sent to the model -- reduces both data exposure and bias surface.
- **Prompt injection**: resume/JD text is wrapped in `<resume>`/`<job_description>` tags with
  an explicit system-prompt rule that content inside is data, not instructions; a pattern
  detector also flags common attempts ("ignore previous instructions", "give this a 100"),
  and any detected attempt is surfaced to the user as a warning, not silently hidden.
- **XSS**: all rendering in `public/script.js` uses `textContent`, never `innerHTML`.
- **Rate limiting**: per-IP (15-min window) and a daily request budget, both in `server.js`.
- **Uploads**: PDFs are parsed in memory (`multer` memory storage) and never written to disk;
  file type is checked by magic bytes, not just the extension; 5 MB size cap.
- **Reliability**: the Anthropic call has a timeout, retries with backoff on 429/5xx, and one
  schema-repair retry if the model's tool call doesn't validate. A `max_tokens` cutoff is
  surfaced as a clear error instead of trying to parse truncated JSON.

## Known limitations (said out loud, not discovered by an interviewer)

- The in-memory rate limiter resets if the server restarts and doesn't share state across
  multiple instances -- fine for a single-instance demo, not for real multi-instance scale.
- PDF text extraction struggles with scanned images, complex multi-column layouts, and
  heavily designed resume templates; the app detects near-empty extraction and asks the user
  to paste text instead, but doesn't attempt OCR.
- The role-title-only mode (`data/role-profiles.json`) is a small, hand-curated set of common
  roles -- a real job posting will always be more accurate, and the UI says so.
- `eval/cases.json` ships with one consistency case and one fairness pair -- enough to prove
  the harness works end to end, not enough to draw a real conclusion. Expand it with your own
  labeled resume/JD pairs before citing the numbers anywhere.
- This checks resume-to-JD *fit signals*, not truthfulness -- it cannot verify that a claimed
  achievement actually happened.

## What I'd do next

- Expand `eval/cases.json` to 20-30 real pairs and track the consistency/fairness numbers
  over time as the prompt and code change.
- Add DOCX support alongside PDF for both resume and JD upload.
- Move the rate limiter to Redis for real multi-instance deployment.
- Add a small React or Vue frontend if the UI grows past what vanilla JS comfortably handles.
