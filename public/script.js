// Every render function below builds DOM nodes and sets .textContent, never
// .innerHTML, on anything derived from the model's output. Model output is
// untrusted input, the same as any other text from outside your server.

const els = {
  resumeText: document.getElementById('resumeText'),
  resumeFile: document.getElementById('resumeFile'),
  resumeFileRow: document.getElementById('resumeFileRow'),
  resumeFileName: document.getElementById('resumeFileName'),
  resumeCount: document.getElementById('resumeCount'),
  jdText: document.getElementById('jdText'),
  jdFile: document.getElementById('jdFile'),
  jdFileRow: document.getElementById('jdFileRow'),
  jdFileName: document.getElementById('jdFileName'),
  jdRoleRow: document.getElementById('jdRoleRow'),
  roleTitle: document.getElementById('roleTitle'),
  jdCount: document.getElementById('jdCount'),
  runBtn: document.getElementById('runBtn'),
  runHint: document.getElementById('runHint'),
  errorBox: document.getElementById('errorBox'),
  output: document.getElementById('output'),
  verdictBox: document.getElementById('verdictBox'),
  scoreNum: document.getElementById('scoreNum'),
  verdictTitle: document.getElementById('verdictTitle'),
  verdictDesc: document.getElementById('verdictDesc'),
  jdBanner: document.getElementById('jdBanner'),
  warningsBanner: document.getElementById('warningsBanner'),
  breakdownList: document.getElementById('breakdownList'),
  testsList: document.getElementById('testsList'),
  matchedTags: document.getElementById('matchedTags'),
  missingTags: document.getElementById('missingTags'),
  fixesList: document.getElementById('fixesList'),
  metaRow: document.getElementById('metaRow'),
};

const state = { resumeMode: 'paste', jdMode: 'paste' };

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

// --- tab switching (resume: paste/pdf; jd: paste/pdf/role) ---
document.querySelectorAll('.tabs').forEach((group) => {
  const target = group.dataset.target;
  group.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.mode;
      if (target === 'resume') {
        state.resumeMode = mode;
        els.resumeText.style.display = mode === 'paste' ? 'block' : 'none';
        els.resumeFileRow.style.display = mode === 'pdf' ? 'flex' : 'none';
      } else {
        state.jdMode = mode;
        els.jdText.style.display = mode === 'paste' ? 'block' : 'none';
        els.jdFileRow.style.display = mode === 'pdf' ? 'flex' : 'none';
        els.jdRoleRow.style.display = mode === 'role' ? 'block' : 'none';
      }
    });
  });
});

els.resumeFile.addEventListener('change', () => {
  els.resumeFileName.textContent = els.resumeFile.files[0]?.name || 'No file chosen';
});
els.jdFile.addEventListener('change', () => {
  els.jdFileName.textContent = els.jdFile.files[0]?.name || 'No file chosen';
});
els.resumeText.addEventListener('input', () => {
  els.resumeCount.textContent = els.resumeText.value.length;
});
els.jdText.addEventListener('input', () => {
  els.jdCount.textContent = els.jdText.value.length;
});

function showError(msg) {
  els.errorBox.textContent = msg;
  els.errorBox.classList.add('show');
}
function clearError() {
  els.errorBox.textContent = '';
  els.errorBox.classList.remove('show');
}

function buildRequestBody() {
  const usingFiles = state.resumeMode === 'pdf' || state.jdMode === 'pdf';
  if (usingFiles) {
    const fd = new FormData();
    if (state.resumeMode === 'pdf') {
      if (!els.resumeFile.files[0]) throw new Error('Choose a resume PDF, or switch back to Paste.');
      fd.append('resumeFile', els.resumeFile.files[0]);
    } else {
      fd.append('resume', els.resumeText.value.trim());
    }
    if (state.jdMode === 'pdf') {
      if (!els.jdFile.files[0]) throw new Error('Choose a job description PDF, or switch to another tab.');
      fd.append('jdFile', els.jdFile.files[0]);
    } else if (state.jdMode === 'role') {
      fd.append('roleTitle', els.roleTitle.value.trim());
    } else {
      fd.append('jd', els.jdText.value.trim());
    }
    return { body: fd, headers: {} };
  }
  const payload = { resume: els.resumeText.value.trim() };
  if (state.jdMode === 'role') payload.roleTitle = els.roleTitle.value.trim();
  else payload.jd = els.jdText.value.trim();
  return { body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } };
}

els.runBtn.addEventListener('click', async () => {
  clearError();
  els.output.classList.remove('show');
  let req;
  try {
    req = buildRequestBody();
  } catch (e) {
    showError(e.message);
    return;
  }

  els.runBtn.disabled = true;
  els.runBtn.textContent = 'Analyzing…';
  try {
    const res = await fetch('/api/analyze', { method: 'POST', headers: req.headers, body: req.body });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Analysis failed.');
    render(data);
  } catch (e) {
    showError(e.message || 'Something went wrong.');
  } finally {
    els.runBtn.disabled = false;
    els.runBtn.textContent = 'Analyze';
  }
});

function tierFromScore(score) {
  if (score >= 75) return 'pass';
  if (score >= 50) return 'warn';
  return 'fail';
}

function render(data) {
  const tier = tierFromScore(data.overall_score);

  els.scoreNum.textContent = data.overall_score;
  els.verdictBox.className = `verdict ${tier}`;
  els.verdictTitle.textContent = data.verdict;
  els.verdictTitle.className = `verdict-title ${tier}`;
  els.verdictDesc.textContent = data.verdict_reason;

  if (data.jd_source) {
    els.jdBanner.style.display = 'block';
    els.jdBanner.className = `banner ${data.jd_source.confidence === 'low' ? 'warn' : ''}`;
    els.jdBanner.textContent = `Compared against: ${data.jd_source.source} (${data.jd_source.confidence} confidence)`;
  }

  if (data.warnings && data.warnings.length) {
    els.warningsBanner.style.display = 'block';
    els.warningsBanner.textContent = '';
    data.warnings.forEach((w) => {
      const p = el('p', null, w);
      els.warningsBanner.appendChild(p);
    });
  } else {
    els.warningsBanner.style.display = 'none';
  }

  els.breakdownList.textContent = '';
  data.score_breakdown.forEach((b) => {
    const row = el('div', 'test-row');
    row.appendChild(el('span', 'test-id', `${b.earned}/${b.max}`));
    row.appendChild(el('span', 'test-name', b.label));
    const bar = el('div', 'bar-track');
    const fill = el('div', 'bar-fill');
    fill.style.width = `${b.max ? (b.earned / b.max) * 100 : 0}%`;
    bar.appendChild(fill);
    row.appendChild(bar);
    els.breakdownList.appendChild(row);
  });

  els.testsList.textContent = '';
  data.checks.forEach((t) => {
    const row = el('div', 'test-row');
    row.appendChild(el('span', 'test-id', t.id));
    row.appendChild(el('span', 'test-name', t.name.replace(/_/g, ' ')));
    row.appendChild(el('span', 'test-detail', t.detail));
    row.appendChild(el('span', `pill ${t.status}`, t.status.toUpperCase()));
    els.testsList.appendChild(row);
  });

  els.matchedTags.textContent = '';
  if (data.matched_skills.length === 0) {
    els.matchedTags.appendChild(el('span', 'empty-note', 'No evidence-checked matches found.'));
  } else {
    data.matched_skills.forEach((m) => {
      const tag = el('span', 'tag matched', m.skill);
      tag.title = `Evidence: "${m.evidence}"`;
      els.matchedTags.appendChild(tag);
    });
  }

  els.missingTags.textContent = '';
  if (data.missing_skills.length === 0) {
    els.missingTags.appendChild(el('span', 'empty-note', 'No major gaps found.'));
  } else {
    data.missing_skills.forEach((s) => els.missingTags.appendChild(el('span', 'tag missing', s)));
  }

  els.fixesList.textContent = '';
  if (data.fixes.length === 0) {
    els.fixesList.appendChild(el('p', 'none', 'No specific fixes suggested.'));
  } else {
    data.fixes.forEach((f, i) => {
      const row = el('div', 'fix');
      row.appendChild(el('span', 'fix-marker', `${i + 1}.`));
      row.appendChild(el('span', 'fix-text', f)); // textContent only -- no bold parsing of model text
      els.fixesList.appendChild(row);
    });
  }

  const m = data.meta;
  els.metaRow.textContent = `Model: ${m.model} · ${m.total_ms}ms · ${m.input_tokens + m.output_tokens} tokens · ${m.attempts} attempt(s)`;

  els.output.classList.add('show');
}
