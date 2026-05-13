/*
 * Changes:
 * - Added election/candidate CRUD helpers and Anthropic election lookup for admin seeding.
 */
/**
 * SETUP — run these statements in Supabase SQL Editor before deploying:
 *
 *   -- 1. Add national ID number column (idempotent):
 *   ALTER TABLE verifications ADD COLUMN IF NOT EXISTS national_id_number TEXT;
 *
 *   -- 2. Create Storage bucket for ID photo uploads (one-time, in Supabase dashboard
 *          Storage → New bucket → name: "verification-ids" → Public: ON).
 *          Or via SQL:
 *   INSERT INTO storage.buckets (id, name, public)
 *   VALUES ('verification-ids', 'verification-ids', true)
 *   ON CONFLICT (id) DO NOTHING;
 */
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
    .select('id,user_id,full_name,address,birthdate,national_id_number,photo_id_url,status,submitted_at,reviewed_at,reviewed_by_admin_id')
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

// ── Voter-facing verification API ─────────────────────────────────────────────

/**
 * Fetches the authenticated user's most recent verification row.
 * Returns null instead of throwing on any error so callers can safely fall
 * through to the empty / no-record state without defensive try/catch at the
 * call site.
 *
 * @returns {Promise<{ id: number, status: string, submitted_at: string, reviewed_at: string | null } | null>}
 */
export async function getMyVerification() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.id) return null;

    const { data, error } = await supabase
      .from('verifications')
      .select('id,status,submitted_at,reviewed_at')
      .eq('user_id', user.id)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return null;
    return data || null;
  } catch {
    return null; // network / unexpected error — treat as no record
  }
}

/**
 * Uploads the ID photo to Storage, then inserts a PENDING verification row.
 *
 * Throws a user-readable Error if the Storage upload fails so the UI can
 * surface the message without attempting a DB insert with a null photo URL.
 *
 * @param {{ nationalIdNumber: string, fullName: string, dateOfBirth: string,
 *           barangay: string, municipality: string, province: string,
 *           photoFile: File }} params
 * @returns {Promise<void>}
 */
export async function submitVerification({
  nationalIdNumber,
  fullName,
  dateOfBirth,
  barangay,
  municipality,
  province,
  photoFile,
}) {
  // Resolve the authenticated user id first.
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.id) {
    throw new Error('You must be signed in to submit a verification.');
  }

  // Build a unique storage path: {user_id}/{timestamp}.{ext}
  const ext = photoFile.name.split('.').pop() || 'bin';
  const storagePath = `${user.id}/${Date.now()}.${ext}`;

  // Upload the photo — throw a user-readable error if this step fails.
  const { error: uploadError } = await supabase.storage
    .from('verification-ids')
    .upload(storagePath, photoFile, { upsert: false });

  if (uploadError) {
    throw new Error(
      toErrorMessage(uploadError, 'Photo upload failed. Please try again with a smaller file or a different format.')
    );
  }

  // Retrieve the public URL (bucket is public so no signed URL needed).
  const { data: { publicUrl } } = supabase.storage
    .from('verification-ids')
    .getPublicUrl(storagePath);

  // Insert the verification row.
  const address = [barangay, municipality, province].filter(Boolean).join(', ');
  const { error: insertError } = await supabase.from('verifications').insert({
    user_id: user.id,
    full_name: fullName,
    birthdate: dateOfBirth,
    address,
    national_id_number: nationalIdNumber,
    photo_id_url: publicUrl,
    status: 'PENDING',
    submitted_at: new Date().toISOString(),
  });

  if (insertError) {
    throw new Error(toErrorMessage(insertError, 'Submission failed. Please try again.'));
  }
}

// ── Admin elections + candidates CRUD ───────────────────────────────────────

/**
 * Creates a new election row.
 * @param {{ name: string, region: string, start_time: string, end_time: string, status: string }} payload
 * @returns {Promise<any>}
 */
export async function createElection({ name, region, start_time, end_time, status }) {
  const adminProfile = await getCurrentAdminProfile();
  const { data, error } = await supabase
    .from('elections')
    .insert({
      name,
      region,
      start_time,
      end_time,
      status,
      is_deleted: false,
      created_by_admin_id: adminProfile?.id ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(toErrorMessage(error, 'Unable to create election.'));
  }
  return data;
}

/**
 * Updates an election row.
 * @param {string | number} id
 * @param {{ name: string, region: string, start_time: string, end_time: string, status: string }} payload
 * @returns {Promise<any>}
 */
export async function updateElection(id, { name, region, start_time, end_time, status }) {
  const { data, error } = await supabase
    .from('elections')
    .update({ name, region, start_time, end_time, status })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(toErrorMessage(error, 'Unable to update election.'));
  }
  return data;
}

/**
 * Creates a candidate row.
 * @param {{ election_id: number, name: string, party: string, position: string, photo_url?: string, bio: string, education: string, experience?: string, display_order: number }} payload
 * @returns {Promise<any>}
 */
export async function createCandidate({
  election_id,
  name,
  party,
  position,
  photo_url,
  bio,
  education,
  experience,
  display_order,
}) {
  const { data, error } = await supabase
    .from('candidates')
    .insert({
      election_id,
      name,
      party,
      position,
      photo_url,
      bio,
      education,
      experience,
      display_order,
    })
    .select()
    .single();

  if (error) {
    throw new Error(toErrorMessage(error, 'Unable to create candidate.'));
  }
  return data;
}

/**
 * Updates a candidate row.
 * @param {string | number} id
 * @param {{ election_id?: number, name?: string, party?: string, position?: string, photo_url?: string, bio?: string, education?: string, experience?: string, display_order?: number }} payload
 * @returns {Promise<any>}
 */
export async function updateCandidate(id, payload) {
  const { data, error } = await supabase
    .from('candidates')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(toErrorMessage(error, 'Unable to update candidate.'));
  }
  return data;
}

// ── AI election lookup — Supabase Edge Function ───────────────────────────────
// CHANGED: Use supabase.functions.invoke so the current user's JWT is sent.
// The Edge Function defaults to verify_jwt=true, so anon-key fetches return 401.

/**
 * Fetches the most recent Philippine election and candidates via the Supabase
 * Edge Function at /functions/v1/fetch-ph-election.
 *
 * The Edge Function calls Anthropic server-side using a secret API key and
 * returns the raw Anthropic JSON body — parsed here identically to before.
 *
 * @returns {Promise<{ election: { name: string, region: string, start_date: string, end_date: string, status: string }, candidates: Array }>}
 */
export async function fetchLatestPhElection() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData?.session?.access_token) {
    throw new Error('You must be signed in to fetch election data.');
  }

  const { data: payload, error } = await supabase.functions.invoke('fetch-ph-election', {
    method: 'POST',
  });

  if (error) {
    throw new Error(toErrorMessage(error, 'Unable to fetch election data.'));
  }
  const text = Array.isArray(payload?.content)
    ? payload.content
        .filter((block) => block?.type === 'text')
        .map((block) => block.text)
        .join('\n')
    : '';

  if (!text) {
    throw new Error('Unable to parse election data. No text content returned.');
  }

  const sanitized = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(sanitized);
  } catch {
    throw new Error('Unable to parse election data. Invalid JSON returned.');
  }
}


