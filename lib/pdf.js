const pdfParse = require('pdf-parse');
const { HttpError } = require('./errors');

const PDF_MAGIC = '%PDF-';

// Converts an uploaded PDF buffer to plain text, or throws a clean 400 the
// route can show directly to the user instead of crashing on a bad file.
async function pdfBufferToText(buffer, label) {
  if (!buffer || buffer.length === 0) throw new HttpError(400, `${label} file is empty.`);
  if (buffer.subarray(0, 5).toString('latin1') !== PDF_MAGIC) {
    throw new HttpError(400, `${label} does not look like a valid PDF file.`);
  }
  let parsed;
  try {
    parsed = await pdfParse(buffer);
  } catch (e) {
    throw new HttpError(400, `Could not read ${label} PDF. It may be corrupted or password-protected.`);
  }
  const text = (parsed.text || '').trim();
  if (text.length < 100) {
    throw new HttpError(
      400,
      `${label} PDF has almost no extractable text. It may be a scanned image -- try a text-based PDF, or paste the text directly.`
    );
  }
  return text;
}

module.exports = { pdfBufferToText };
