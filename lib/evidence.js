// The model must back every matched skill with a quote from the resume.
// This is the code-side check that the quote really exists, so the model
// cannot claim a match it cannot point to.

function normalize(s) {
  return String(s)
    .toLowerCase()
    // "10,000" and "10000" should match as the same number -- strip
    // thousands-separator commas before word-splitting collapses everything
    // else to spaces, or the digit grouping would come out different on
    // each side of a comparison.
    .replace(/(\d),(\d{3})/g, '$1$2')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function verifyEvidence(sourceText, quote) {
  if (typeof quote !== 'string') return false;
  const haystack = normalize(sourceText);
  // Models often join two pieces of a bullet with "..."; check each piece.
  const fragments = quote
    .split(/\.{3}|\u2026/)
    .map(normalize)
    .filter((f) => f.length >= 8);
  if (fragments.length === 0) return false;
  return fragments.every((f) => haystack.includes(f));
}

module.exports = { verifyEvidence, normalize };
