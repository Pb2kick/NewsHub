export const NEWS_CATEGORY_TOP_STORIES = 'Top Stories';
export const NEWS_CATEGORY_POLITICS = 'Politics';
export const NEWS_CATEGORY_ECONOMY = 'Economy';
export const NEWS_CATEGORY_TECHNOLOGY = 'Technology';
export const NEWS_CATEGORY_ELECTIONS = 'Elections';

export const NEWS_CATEGORY_TABS = [
  NEWS_CATEGORY_TOP_STORIES,
  NEWS_CATEGORY_POLITICS,
  NEWS_CATEGORY_ECONOMY,
  NEWS_CATEGORY_TECHNOLOGY,
  NEWS_CATEGORY_ELECTIONS,
];

const EXPLICIT_CATEGORY_ALIASES = {
  'top story': NEWS_CATEGORY_TOP_STORIES,
  'top stories': NEWS_CATEGORY_TOP_STORIES,
  politics: NEWS_CATEGORY_POLITICS,
  policy: NEWS_CATEGORY_POLITICS,
  economy: NEWS_CATEGORY_ECONOMY,
  business: NEWS_CATEGORY_ECONOMY,
  technology: NEWS_CATEGORY_TECHNOLOGY,
  tech: NEWS_CATEGORY_TECHNOLOGY,
  elections: NEWS_CATEGORY_ELECTIONS,
  election: NEWS_CATEGORY_ELECTIONS,
};

const CATEGORY_KEYWORDS = {
  [NEWS_CATEGORY_POLITICS]: ['politic', 'government', 'senate', 'congress', 'policy', 'commission', 'legislation'],
  [NEWS_CATEGORY_ECONOMY]: ['economy', 'economic', 'business', 'market', 'finance', 'inflation', 'trade', 'gdp', 'investment'],
  [NEWS_CATEGORY_TECHNOLOGY]: ['technology', 'tech', 'cyber', 'digital', 'software', 'ai', 'data', 'platform', 'innovation'],
  [NEWS_CATEGORY_ELECTIONS]: ['election', 'vote', 'voting', 'ballot', 'candidate', 'campaign', 'poll', 'commission on elections'],
};

/**
 * Converts explicit source category into one of the supported homepage tabs.
 * @param {string} rawCategory
 * @returns {string}
 */
function normalizeExplicitCategory(rawCategory) {
  const normalized = String(rawCategory || '').trim().toLowerCase();
  if (!normalized) {
    return '';
  }

  if (EXPLICIT_CATEGORY_ALIASES[normalized]) {
    return EXPLICIT_CATEGORY_ALIASES[normalized];
  }

  if (normalized.includes('politic')) {
    return NEWS_CATEGORY_POLITICS;
  }
  if (normalized.includes('econom') || normalized.includes('business')) {
    return NEWS_CATEGORY_ECONOMY;
  }
  if (normalized.includes('tech')) {
    return NEWS_CATEGORY_TECHNOLOGY;
  }
  if (normalized.includes('elect') || normalized.includes('vote')) {
    return NEWS_CATEGORY_ELECTIONS;
  }

  return '';
}

/**
 * Builds weighted category scores from article text for permissive fallback.
 * @param {string} searchableText
 * @returns {Record<string, number>}
 */
function scoreCategories(searchableText) {
  const scores = {
    [NEWS_CATEGORY_POLITICS]: 0,
    [NEWS_CATEGORY_ECONOMY]: 0,
    [NEWS_CATEGORY_TECHNOLOGY]: 0,
    [NEWS_CATEGORY_ELECTIONS]: 0,
  };

  for (const [category, terms] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const term of terms) {
      if (searchableText.includes(term)) {
        scores[category] += term.length > 7 ? 2 : 1;
      }
    }
  }

  return scores;
}

/**
 * Resolves one of the supported homepage categories for a news article.
 * @param {{ category?: string, title?: string, excerpt?: string, content?: string }} article
 * @returns {string}
 */
export function resolveNewsCategory(article) {
  const explicitCategory = normalizeExplicitCategory(article?.category);
  if (explicitCategory) {
    return explicitCategory;
  }

  const searchable = `${article?.title || ''} ${article?.excerpt || ''} ${article?.content || ''}`.toLowerCase();
  const scores = scoreCategories(searchable);
  let bestCategory = NEWS_CATEGORY_TOP_STORIES;
  let bestScore = 0;

  for (const [category, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestCategory = category;
      bestScore = score;
    }
  }

  return bestScore > 0 ? bestCategory : NEWS_CATEGORY_TOP_STORIES;
}

/**
 * Tags incoming articles with a normalized homepage category.
 * @param {Array<any>} articles
 * @returns {Array<any>}
 */
export function tagNewsArticlesByCategory(articles) {
  return (articles || []).map((article) => ({
    ...article,
    category: resolveNewsCategory(article),
  }));
}

/**
 * Returns articles filtered by selected homepage category tab.
 * @param {Array<any>} taggedArticles
 * @param {string} selectedCategory
 * @returns {Array<any>}
 */
export function filterNewsByCategory(taggedArticles, selectedCategory) {
  if (selectedCategory === NEWS_CATEGORY_TOP_STORIES) {
    return taggedArticles;
  }
  return taggedArticles.filter((article) => article.category === selectedCategory);
}
