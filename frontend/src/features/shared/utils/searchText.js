/**
 * Client-side matching for the small election/candidate lists, using the same
 * rule as article search: every typed word must appear somewhere (any order),
 * and the last word may be partial while typing.
 */

/** @param {string} text */
function words(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * @param {Array<string | null | undefined>} fields values to search in
 * @param {string} query user's search text
 * @returns {boolean}
 */
export function matchesAllWords(fields, query) {
  const queryWords = words(query);
  if (queryWords.length === 0) return false;
  const haystack = words(fields.filter(Boolean).join(' '));
  return queryWords.every((queryWord, index) => {
    const isLast = index === queryWords.length - 1;
    return haystack.some((word) => (isLast ? word.startsWith(queryWord) : word === queryWord));
  });
}

/**
 * Elections whose name, region or status match the query.
 * @param {Array} elections
 * @param {string} query
 * @param {number} [limit]
 */
export function filterElections(elections, query, limit = 5) {
  return (elections || [])
    .filter((election) => matchesAllWords([election.title, election.region, election.status], query))
    .slice(0, limit);
}

/**
 * Candidates whose name, party or position match the query, or whose election's
 * name does (searching "2026 election" lists its candidates).
 * @param {Array} candidates
 * @param {Array} elections
 * @param {string} query
 * @param {number} [limit]
 */
export function filterCandidates(candidates, elections, query, limit = 5) {
  const electionTitles = new Map((elections || []).map((election) => [String(election.id), election.title]));
  return (candidates || [])
    .filter((candidate) => matchesAllWords(
      [candidate.name, candidate.party, candidate.position, electionTitles.get(String(candidate.electionId))],
      query
    ))
    .slice(0, limit);
}
