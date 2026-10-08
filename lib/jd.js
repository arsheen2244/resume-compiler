const { HttpError } = require('./errors');
const roleProfiles = require('../data/role-profiles.json');

function slugify(title) {
  return String(title).trim().toLowerCase().replace(/\s+/g, ' ');
}

function formatProfile(title, profile) {
  return [
    `Role: ${title}`,
    `Must-have skills: ${profile.must_have.join(', ')}`,
    `Nice-to-have skills: ${profile.nice_to_have.join(', ')}`,
    `Typical responsibilities: ${profile.responsibilities.join('; ')}`,
  ].join('\n');
}

// Turns whatever the user gave us (pasted JD text, or just a role title)
// into one normalized shape the rest of the pipeline doesn't need to think
// about: { text, source, confidence }. This is the seam mentioned in chat --
// everything downstream only ever sees this shape.
function buildJD({ jdText, roleTitle }, cfg) {
  const pasted = typeof jdText === 'string' ? jdText.trim() : '';
  if (pasted.length >= cfg.limits.minJdChars) {
    return { text: pasted.slice(0, cfg.limits.jdChars), source: 'pasted job description', confidence: 'high' };
  }

  const title = typeof roleTitle === 'string' ? roleTitle.trim().slice(0, cfg.limits.roleTitleChars) : '';
  if (!title) {
    throw new HttpError(
      400,
      `Job description must be at least ${cfg.limits.minJdChars} characters, or provide a role title instead.`
    );
  }

  const profile = roleProfiles[slugify(title)];
  if (profile) {
    return { text: formatProfile(title, profile), source: `curated profile for "${title}"`, confidence: 'medium' };
  }
  return {
    text: `Role: ${title}\n(No detailed requirements available -- infer typical requirements for this role from general knowledge.)`,
    source: `generated profile for "${title}" (not a real job description)`,
    confidence: 'low',
  };
}

module.exports = { buildJD, slugify };
