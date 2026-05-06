import { supabase } from '../../shared/services/supabaseClient';

/**
 * Builds a stable human-readable API error message.
 * @param {any} error
 * @param {string} fallback
 * @returns {string}
 */
function toErrorMessage(error, fallback) {
  const details = error?.message || error?.details || '';
  return details ? `${fallback} (${details})` : fallback;
}

/**
 * Loads current authenticated profile row from public.users.
 * @returns {Promise<{id: number, email: string, role: string} | null>}
 */
export async function getCurrentAdminProfile() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    return null;
  }

  const { data, error } = await supabase
    .from('users')
    .select('id,email,role')
    .eq('email', user.email)
    .maybeSingle();

  if (error) {
    return null;
  }
  return data || null;
}

/**
 * Runs a counted query and returns 0 on missing table errors.
 * @param {string} tableName
 * @param {(query: any) => any} [configure]
 * @returns {Promise<number>}
 */
async function getCount(tableName, configure) {
  let query = supabase.from(tableName).select('id', { count: 'exact', head: true });
  if (configure) {
    query = configure(query);
  }
  const { count, error } = await query;
  if (error) {
    return 0;
  }
  return Number(count || 0);
}

/**
 * Fetches dashboard card statistics.
 * @returns {Promise<{users: number, elections: number, articles: number, pendingVerifications: number}>}
 */
export async function getDashboardStats() {
  const [users, elections, articles, pendingVerifications] = await Promise.all([
    getCount('users'),
    getCount('elections'),
    getCount('news'),
    getCount('verifications', (query) => query.eq('status', 'PENDING')),
  ]);
  return { users, elections, articles, pendingVerifications };
}

/**
 * Aggregates last 7 days vote totals by day label.
 * @returns {Promise<Array<{label: string, value: number}>>}
 */
export async function getLastSevenDayVotes() {
  const since = new Date();
  since.setDate(since.getDate() - 6);
  const { data, error } = await supabase
    .from('votes')
    .select('voted_at')
    .gte('voted_at', since.toISOString())
    .order('voted_at', { ascending: true });

  if (error || !data) {
    return [];
  }

  /** Builds compact day key from a date string. */
  const toKey = (iso) => new Date(iso).toISOString().slice(0, 10);
  const totals = new Map();
  for (let i = 0; i < 7; i += 1) {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    totals.set(toKey(date.toISOString()), 0);
  }
  data.forEach((item) => {
    const key = toKey(item.voted_at);
    totals.set(key, (totals.get(key) || 0) + 1);
  });

  return [...totals.entries()].map(([key, value]) => {
    const label = new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
    return { label, value };
  });
}

/**
 * Lists verifications with optional status filter.
 * @param {{ status?: string, search?: string }} params
 * @returns {Promise<Array<any>>}
 */
export async function listVerifications({ status, search } = {}) {
  let query = supabase
    .from('verifications')
    .select('id,user_id,full_name,address,birthdate,photo_id_url,status,submitted_at,reviewed_at,reviewed_by_admin_id')
    .order('submitted_at', { ascending: false });

  if (status && status !== 'ALL') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(toErrorMessage(error, 'Unable to load verifications.'));
  }

  const normalized = (data || []).map((item) => ({
    ...item,
    status: String(item.status || 'PENDING').toUpperCase(),
  }));

  const term = String(search || '').trim().toLowerCase();
  if (!term) {
    return normalized;
  }

  return normalized.filter((item) => {
    const text = `${item.full_name || ''} ${item.address || ''} ${item.status || ''}`.toLowerCase();
    return text.includes(term);
  });
}

/**
 * Fetches a verification record by id.
 * @param {string | number} verificationId
 * @returns {Promise<any | null>}
 */
export async function getVerificationById(verificationId) {
  const { data, error } = await supabase
    .from('verifications')
    .select('id,user_id,full_name,address,birthdate,photo_id_url,status,submitted_at,reviewed_at,reviewed_by_admin_id')
    .eq('id', verificationId)
    .maybeSingle();

  if (error) {
    throw new Error(toErrorMessage(error, 'Unable to load verification details.'));
  }
  return data || null;
}

/**
 * Updates verification decision metadata.
 * @param {{ verificationId: string | number, status: 'APPROVED' | 'REJECTED', adminUserId: string | number }} params
 * @returns {Promise<void>}
 */
export async function updateVerificationStatus({ verificationId, status, adminUserId }) {
  const payload = {
    status,
    reviewed_at: new Date().toISOString(),
    reviewed_by_admin_id: Number(adminUserId),
  };

  const { error } = await supabase.from('verifications').update(payload).eq('id', verificationId);
  if (error) {
    throw new Error(toErrorMessage(error, 'Unable to update verification status.'));
  }
}

/**
 * Lists elections sorted by start time.
 * @returns {Promise<Array<any>>}
 */
export async function listElections() {
  const { data, error } = await supabase
    .from('elections')
    .select('id,name,region,start_time,end_time,status,created_by_admin_id,is_deleted')
    .eq('is_deleted', false)
    .order('start_time', { ascending: true });

  if (error) {
    throw new Error(toErrorMessage(error, 'Unable to load elections.'));
  }
  return data || [];
}

/**
 * Soft deletes an election row.
 * @param {string | number} electionId
 * @returns {Promise<void>}
 */
export async function deleteElection(electionId) {
  const { error } = await supabase.from('elections').update({ is_deleted: true }).eq('id', electionId);
  if (error) {
    throw new Error(toErrorMessage(error, 'Unable to delete election.'));
  }
}

/**
 * Lists all candidates and minimal election metadata.
 * @returns {Promise<Array<any>>}
 */
export async function listCandidates() {
  const { data, error } = await supabase
    .from('candidates')
    .select('id,election_id,name,position,party,photo_url,education,experience,bio,display_order')
    .order('display_order', { ascending: true });

  if (error) {
    throw new Error(toErrorMessage(error, 'Unable to load candidates.'));
  }
  return data || [];
}

/**
 * Deletes candidate row permanently.
 * @param {string | number} candidateId
 * @returns {Promise<void>}
 */
export async function deleteCandidate(candidateId) {
  const { error } = await supabase.from('candidates').delete().eq('id', candidateId);
  if (error) {
    throw new Error(toErrorMessage(error, 'Unable to delete candidate.'));
  }
}

/**
 * Lists moderation-ready news records.
 * @returns {Promise<Array<any>>}
 */
export async function listNews() {
  const { data, error } = await supabase
    .from('news')
    .select('id,title,summary,source,source_url,country,region,published_at,user_id')
    .order('published_at', { ascending: false });

  if (error) {
    throw new Error(toErrorMessage(error, 'Unable to load news.'));
  }
  return data || [];
}

/**
 * Deletes one news row permanently.
 * @param {string | number} newsId
 * @returns {Promise<void>}
 */
export async function deleteNews(newsId) {
  const { error } = await supabase.from('news').delete().eq('id', newsId);
  if (error) {
    throw new Error(toErrorMessage(error, 'Unable to delete news item.'));
  }
}
