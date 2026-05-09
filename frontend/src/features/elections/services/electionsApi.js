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
    image: '',
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
      .select('id,name,region,start_time,end_time,status,is_deleted')
      .eq('is_deleted', false)
      .order('start_time', { ascending: true });

    if (error) return null;
    return (data || []).map(mapElection).filter(Boolean);
  } catch {
    return null;
  }
}

export async function getElectionById(id) {
  try {
    const { data, error } = await supabase
      .from('elections')
      .select('id,name,region,start_time,end_time,status,is_deleted')
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
