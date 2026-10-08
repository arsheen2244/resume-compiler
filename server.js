require('dotenv').config();

const path = require('path');
const express = require('express');
const multer = require('multer');

const { getConfig } = require('./lib/config');
const { HttpError } = require('./lib/errors');
const { buildJD } = require('./lib/jd');
const { pdfBufferToText } = require('./lib/pdf');
const { analyze } = require('./lib/analyzer');
const { createRateLimiter, createDailyBudget } = require('./lib/ratelimit');

const cfg = getConfig();
const app = express();

// Needed for req.ip to reflect the real client when deployed behind a proxy
// (Render, Heroku, nginx, etc.) rather than always seeing the proxy's IP.
if (cfg.trustProxy) app.set('trust proxy', cfg.trustProxy);

app.use(express.json({ limit: '1mb' })); // JSON body path (pasted text, no files)
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  storage: multer.memoryStorage(), // never touches disk
  limits: { fileSize: cfg.limits.pdfBytes, files: 2 },
});

app.use('/api', createRateLimiter({ windowMs: 15 * 60 * 1000, max: cfg.rateLimitPer15Min }));
app.use('/api', createDailyBudget(cfg.dailyBudget));

function asyncRoute(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

app.post(
  '/api/analyze',
  upload.fields([
    { name: 'resumeFile', maxCount: 1 },
    { name: 'jdFile', maxCount: 1 },
  ]),
  asyncRoute(async (req, res) => {
    const files = req.files || {};

    let resumeText = files.resumeFile?.[0]
      ? await pdfBufferToText(files.resumeFile[0].buffer, 'Resume')
      : (req.body.resume || '').trim();

    if (resumeText.length < cfg.limits.minResumeChars) {
      throw new HttpError(400, `Resume must be at least ${cfg.limits.minResumeChars} characters, or upload a PDF.`);
    }
    resumeText = resumeText.slice(0, cfg.limits.resumeChars);

    let jdText = files.jdFile?.[0] ? await pdfBufferToText(files.jdFile[0].buffer, 'Job description') : req.body.jd;
    const jd = buildJD({ jdText, roleTitle: req.body.roleTitle }, cfg);

    const result = await analyze({ resumeText, jd });
    res.json(result);
  })
);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, provider: cfg.provider, model: cfg.activeModel, hasApiKey: cfg.hasCredentials });
});

// Multer errors (e.g. file too large) arrive here, not in the route.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (5 MB max).' : `Upload error: ${err.message}`;
    return res.status(400).json({ error: msg });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error('[unhandled]', err); // never logs resume/JD text, only the error
  res.status(500).json({ error: 'Something went wrong on our end. Please try again.' });
});

app.listen(cfg.port, () => {
  console.log(`Resume Compiler listening on http://localhost:${cfg.port}`);
  console.log(`LLM provider: ${cfg.provider} (${cfg.activeModel})`);
  if (!cfg.hasCredentials) console.warn('WARNING: no API key set for the selected LLM_PROVIDER -- /api/analyze will fail until you set it in .env');
});

module.exports = app;
