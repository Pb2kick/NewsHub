/*
 * Changes:
 * - Added Supabase-backed elections and candidates queries with safe mapping for voter screens.
 */
import { supabase } from '../../shared/services/supabaseClient';

function formatElectionDate(value) {
  if (!value) return 'TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function normalizeStatus(value) {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'ACTIVE') return 'Active';
  if (normalized === 'COMPLETED' || normalized === 'ENDED') return 'Completed';
  if (normalized === 'UPCOMING') return 'Upcoming';
  return value || 'Upcoming';
}

function mapElection(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.name,
    scope: 'National',
    region: row.region || 'National',
    date: formatElectionDate(row.start_time),
    status: normalizeStatus(row.status),
    candidatesCount: 0,
    image: row.image_url || '',
  };
}

function mapCandidate(row) {
  if (!row) return null;
  return {
    id: row.id,
    electionId: row.election_id,
    name: row.name,
    party: row.party,
    position: row.position,
    bio: row.bio,
    image: row.photo_url || '',
    age: null,
    education: row.education || '',
    yearsInOffice: null,
    residence: '',
  };
}

export async function getElections() {
  try {
    const { data, error } = await supabase
      .from('elections')
      .select('id,name,region,start_time,end_time,status,image_url,is_deleted')
      .eq('is_deleted', false)
      .order('start_time', { ascending: true });

    if (error) return null;
    return (data || []).map(mapElection).filter(Boolean);
  } catch {
    return null;
  }
}

let searchableCache = null;
const SEARCHABLE_TTL_MS = 5 * 60 * 1000;

/**
 * Real elections and their candidates for global search, loaded once and
 * cached for 5 minutes (search used to filter the mockData.js arrays, so it
 * never found the elections shown in the sidebar).
 *
 * @returns {Promise<{ elections: Array, candidates: Array }>} empty lists on failure
 */
export async function getSearchableElections() {
  if (searchableCache && Date.now() - searchableCache.loadedAt < SEARCHABLE_TTL_MS) {
    return searchableCache.data;
  }
  const elections = (await getElections()) || [];
  let candidates = [];
  if (elections.length > 0) {
    try {
      const { data, error } = await supabase
        .from('candidates')
        .select('id,election_id,name,party,position')
        .in('election_id', elections.map((election) => election.id));
      if (!error) {
        candidates = (data || []).map(mapCandidate).filter(Boolean);
      }
    } catch {
      candidates = [];
    }
  }
  const data = { elections, candidates };
  // Only cache successful loads so a temporary failure is retried on the next search.
  if (elections.length > 0) {
    searchableCache = { data, loadedAt: Date.now() };
  }
  return data;
}

export async function getElectionCandidateCount(electionId) {
  if (!electionId) return 0;
  try {
    const { count, error } = await supabase
      .from('candidates')
      .select('id', { count: 'exact', head: true })
      .eq('election_id', electionId);

    if (error) return 0;
    return Number(count || 0);
  } catch {
    return 0;
  }
}

/**
 * Fetches up to 3 candidate photo URLs for the sidebar preview.
 * @param {string | number} electionId
 * @returns {Promise<string[]>} Array of up to 3 photo_url strings (empty string when photo_url is null).
 */
export async function getElectionCandidatePreviews(electionId) {
  if (!electionId) return [];
  try {
    const { data, error } = await supabase
      .from('candidates')
      .select('photo_url,display_order')
      .eq('election_id', electionId)
      .order('display_order', { ascending: true })
      .limit(3);

    if (error) return [];
    return (data || []).map((c) => c.photo_url || '');
  } catch {
    return [];
  }
}

export async function getElectionsWithCounts() {
  const elections = await getElections();
  if (!elections || elections.length === 0) {
    return elections || [];
  }

  const [counts, previews] = await Promise.all([
    Promise.all(elections.map((e) => getElectionCandidateCount(e.id))),
    Promise.all(elections.map((e) => getElectionCandidatePreviews(e.id))),
  ]);

  return elections.map((election, index) => ({
    ...election,
    candidatesCount: counts[index] ?? 0,
    candidatePreviews: previews[index] ?? [],
  }));
}

export async function checkHasVoted(userId, electionId) {
  if (!userId || !electionId) return false;
  try {
    const { data, error } = await supabase
      .from('votes')
      .select('id')
      .eq('user_id', userId)
      .eq('election_id', electionId)
      .maybeSingle();

    if (error) return false;
    return Boolean(data?.id);
  } catch {
    return false;
  }
}

export async function castVote({ electionId, candidateId, userId, authUserId }) { // CHANGED: added authUserId param
  try {
    if (!electionId || !candidateId || !userId) {
      return { success: false, reason: 'UNEXPECTED', message: 'Missing vote details.' };
    }
    // CHANGED: cannot check verification without the auth UUID — fail fast.
    if (!authUserId) {
      return { success: false, reason: 'NOT_VERIFIED' };
    }

    const { data: existingVote, error: voteError } = await supabase
      .from('votes')
      .select('id')
      .eq('user_id', userId)
      .eq('election_id', electionId)
      .maybeSingle();

    if (voteError) {
      return { success: false, reason: 'UNEXPECTED', message: voteError.message };
    }
    if (existingVote?.id) {
      return { success: false, reason: 'ALREADY_VOTED' };
    }

    const { data: electionRow, error: electionError } = await supabase
      .from('elections')
      .select('status')
      .eq('id', electionId)
      .maybeSingle();

    if (electionError) {
      return { success: false, reason: 'UNEXPECTED', message: electionError.message };
    }
    const electionStatus = String(electionRow?.status || '').toUpperCase();
    if (electionStatus !== 'ACTIVE') {
      return { success: false, reason: 'NOT_ACTIVE' };
    }

    const { data: verificationRow, error: verificationError } = await supabase
      .from('verifications')
      .select('status')
      .eq('user_id', authUserId)     // CHANGED: was .eq('user_id', userId) — verifications.user_id is uuid not bigint
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (verificationError) {
      return { success: false, reason: 'UNEXPECTED', message: verificationError.message };
    }
    const verificationStatus = String(verificationRow?.status || '').toUpperCase();
    if (verificationStatus !== 'APPROVED') {
      return { success: false, reason: 'NOT_VERIFIED' };
    }

    const { data: inserted, error: insertError } = await supabase
      .from('votes')
      .insert({
        user_id: userId,
        candidate_id: candidateId,
        election_id: electionId,
        voted_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      return { success: false, reason: 'INSERT_FAILED', message: insertError.message };
    }

    return { success: true, voteId: inserted?.id || null };
  } catch (error) {
    return { success: false, reason: 'UNEXPECTED', message: error?.message || 'Unexpected error.' };
  }
}


export async function getElectionById(id) {
  try {
    const { data, error } = await supabase
      .from('elections')
      .select('id,name,region,start_time,end_time,status,image_url,is_deleted')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle();

    if (error || !data) return null;
    const mapped = mapElection(data);
    return {
      ...mapped,
      start_time: data.start_time,
      end_time: data.end_time,
    };
  } catch {
    return null;
  }
}

export async function getCandidatesByElectionId(electionId) {
  try {
    const { data, error } = await supabase
      .from('candidates')
      .select('id,election_id,name,position,party,photo_url,education,experience,bio,display_order')
      .eq('election_id', electionId)
      .order('display_order', { ascending: true });

    if (error) return [];
    return (data || []).map(mapCandidate).filter(Boolean);
  } catch {
    return [];
  }
}

export async function getCandidateById(candidateId) {
  try {
    const { data, error } = await supabase
      .from('candidates')
      .select('id,election_id,name,position,party,photo_url,education,experience,bio,display_order')
      .eq('id', candidateId)
      .maybeSingle();

    if (error || !data) return null;
    return mapCandidate(data);
  } catch {
    return null;
  }
}
