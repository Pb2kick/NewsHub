/**
 * Normalizes article text and removes common feed truncation artifacts.
 * @param {string} rawText
 * @returns {string}
 */
export function normalizeArticleText(rawText) {
  const collapsed = String(rawText || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!collapsed) {
    return '';
  }

  const withoutTrailingEllipsis = collapsed.replace(/(?:\.\.\.|\u2026)+\s*$/g, '').trim();
  if (!withoutTrailingEllipsis) {
    return '';
  }

  const lastSentenceEnd = Math.max(
    withoutTrailingEllipsis.lastIndexOf('.'),
    withoutTrailingEllipsis.lastIndexOf('!'),
    withoutTrailingEllipsis.lastIndexOf('?')
  );

  if (lastSentenceEnd > Math.floor(withoutTrailingEllipsis.length * 0.5)) {
    return withoutTrailingEllipsis.slice(0, lastSentenceEnd + 1).trim();
  }

  return withoutTrailingEllipsis;
}

/**
 * Splits article text into readable paragraph chunks.
 * @param {string} rawText
 * @returns {string[]}
 */
export function splitArticleIntoParagraphs(rawText) {
  const normalized = normalizeArticleText(rawText);
  if (!normalized) {
    return ['Details for this article are still being synchronized. Please check back shortly for the full story body.'];
  }

  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks = [];

  for (let index = 0; index < sentences.length; index += 3) {
    chunks.push(sentences.slice(index, index + 3).join(' '));
  }

  return chunks.length > 0 ? chunks : [normalized];
}
