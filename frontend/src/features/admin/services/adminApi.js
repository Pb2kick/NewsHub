/*
 * Changes:
 * - Added election/candidate CRUD helpers and image upload helpers.
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

  // ── RLS diagnostic ────────────────────────────────────────────────────────
  // Supabase returns { data: [], error: null } when RLS blocks a SELECT —
  // indistinguishable from a genuinely empty table at the data layer.
  // When the primary query returns empty, run a second count-only query
  // (no status filter, head: true so no rows are transferred).
  // If THAT query errors, the table itself is inaccessible — almost certainly
  // an RLS or permission problem — so surface a clear, actionable message.
  // If the count query also returns no error, the table is either genuinely
  // empty or RLS is silently hiding rows; we return [] and let the improved
  // emptyText in AdminVerifications guide the admin to check policies.
  if ((data || []).length === 0) {
    const { error: countError } = await supabase
      .from('verifications')
      .select('id', { count: 'exact', head: true });

    if (countError) {
      throw new Error(
        'Unable to access the verifications table — this is likely an RLS policy issue. ' +
        'Run the SQL block in the Supabase SQL Editor to create the admin_select_all policy, ' +
        'then reload this page. DB error: ' + (countError.message || 'unknown')
      );
    }
    // count query succeeded: table is accessible but empty (or RLS hides rows silently).
    // Return [] — the improved emptyText in AdminVerifications explains what to check.
  }
  // ── End RLS diagnostic ────────────────────────────────────────────────────

  const normalized = (data || []).map((item) => ({
    ...item,
    // FIX: null/empty status is preserved as null (renders UNKNOWN badge)
    // instead of being masked as 'PENDING' — prevents false PENDING display
    // for rows that have no status column value.
    status: item.status ? String(item.status).toUpperCase() : null,
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

  const { error } = await supabase
    .from('verifications')
    .update(payload)
    .eq('id', verificationId);

  if (error) {
    throw new Error(toErrorMessage(error, 'Unable to update verification status.'));
  }

  // Read-back check: Supabase returns { error: null } even when RLS blocks the
  // UPDATE (0 rows affected). Confirm the change actually persisted in the DB.
  const { data: readBack, error: readError } = await supabase
    .from('verifications')
    .select('status')
    .eq('id', verificationId)
    .maybeSingle();

  if (readError) {
    throw new Error('Update may have succeeded but could not be confirmed. Refresh the page.');
  }

  const actual = String(readBack?.status || '').toUpperCase();
  if (actual !== status.toUpperCase()) {
    throw new Error(
      'The update was blocked by a database policy. ' +
      'Run the RLS SQL block in the Supabase SQL Editor and redeploy.'
    );
  }

  const { data: verificationRow, error: verificationError } = await supabase
    .from('verifications')
    .select('user_id, full_name')
    .eq('id', verificationId)
    .maybeSingle();

  if (!verificationError && verificationRow?.user_id) {
    const notificationType = String(status || '').toUpperCase() === 'APPROVED'
      ? 'VERIFICATION_APPROVED'
      : 'VERIFICATION_REJECTED';

    // Notify the user of the admin's decision so their Profile page reflects the outcome in real time via the existing
    // useNotifications Realtime subscription.
    try {
      const { error: notifyError } = await supabase.from('notifications').insert({
        recipient_user_id: verificationRow.user_id,
        actor_user_id: adminUserId,
        actor_display_name: 'NewsHub Admin',
        actor_photo_url: '',
        comment_id: null,
        article_id: null,
        article_title: null,
        article_snapshot: null,
        is_read: false,
        type: notificationType,
      });
      if (notifyError) {
        // Notification insert failures should not block the verification update.
      }
    } catch {
      // Swallow notification failures silently.
    }
  }
}

/**
 * Lists users with optional search filtering.
 * @param {{ search?: string }} params
 * @returns {Promise<Array<any>>}
 */
export async function listUsers({ search } = {}) {
  try {
    let query = supabase
      .from('users')
      .select('id,email,full_name,role,created_at')
      .order('created_at', { ascending: false });

    const term = String(search || '').trim();
    if (term) {
      const lower = term.toLowerCase();
      query = query.or(`email.ilike.%${lower}%,full_name.ilike.%${lower}%`);
    }

    const { data, error } = await query;
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Bans a user by setting role to BANNED.
 * @param {string} userId
 * @returns {Promise<{ success: boolean, message?: string }>}
 */
export async function banUser(userId) {
  // 'BANNED' role blocks login via RLS policies on the auth layer. Requires a matching RLS policy — see migration block.
  try {
    const { error } = await supabase
      .from('users')
      .update({ role: 'BANNED' })
      .eq('id', userId);

    if (error) {
      return { success: false, message: toErrorMessage(error, 'Unable to ban user.') };
    }
    return { success: true };
  } catch (error) {
    return { success: false, message: error?.message || 'Unable to ban user.' };
  }
}

/**
 * Lists elections sorted by start time.
 * @returns {Promise<Array<any>>}
 */
export async function listElections() {
  const { data, error } = await supabase
    .from('elections')
    .select('id,name,region,start_time,end_time,status,image_url,created_by_admin_id,is_deleted')
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
 * @param {{ name: string, region: string, start_time: string, end_time: string, status: string, image_url: string }} payload
 * @returns {Promise<any>}
 */
export async function createElection({ name, region, start_time, end_time, status, image_url }) {
  const normalizedStatus = String(status || '').toUpperCase();
  const adminProfile = await getCurrentAdminProfile();
  const { data, error } = await supabase
    .from('elections')
    .insert({
      name,
      region,
      start_time,
      end_time,
      status: normalizedStatus,
      image_url,
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
 * @param {{ name: string, region: string, start_time: string, end_time: string, status: string, image_url: string }} payload
 * @returns {Promise<any>}
 */
export async function updateElection(id, { name, region, start_time, end_time, status, image_url }) {
  const normalizedStatus = String(status || '').toUpperCase();
  const { data, error } = await supabase
    .from('elections')
    .update({ name, region, start_time, end_time, status: normalizedStatus, image_url })
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

/**
 * Sanitizes uploaded filenames for storage paths.
 * @param {string} name
 * @returns {string}
 */
function sanitizeFilename(name) {
  const cleaned = String(name || 'image')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');
  return cleaned || 'image';
}

/**
 * Uploads an election image to Supabase Storage and returns the public URL.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function uploadElectionImage(file) {
  if (!file) {
    throw new Error('Please select an image to upload.');
  }

  const safeName = sanitizeFilename(file.name);
  const path = `elections/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase
    .storage
    .from('election-images')
    .upload(path, file, { upsert: false });

  if (uploadError) {
    throw new Error(toErrorMessage(uploadError, 'Image upload failed. Please try again.'));
  }

  const { data: { publicUrl } } = supabase
    .storage
    .from('election-images')
    .getPublicUrl(path);

  return publicUrl;
}

/**
 * Uploads a candidate image to Supabase Storage and returns the public URL.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function uploadCandidateImage(file) {
  if (!file) {
    throw new Error('Please select an image to upload.');
  }

  const safeName = sanitizeFilename(file.name);
  const path = `candidates/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase
    .storage
    .from('election-images')
    .upload(path, file, { upsert: false });

  if (uploadError) {
    throw new Error(toErrorMessage(uploadError, 'Image upload failed. Please try again.'));
  }

  const { data: { publicUrl } } = supabase
    .storage
    .from('election-images')
    .getPublicUrl(path);

  return publicUrl;
}


