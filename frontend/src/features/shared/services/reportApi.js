import { supabase } from './supabaseClient';

/**
 * Submits a content report for the authenticated user.
 * @param {{ targetType: string, targetId: string, targetLabel?: string, reason: string, details?: string }} params
 * @returns {Promise<{ success: true }>}
 */
export async function submitReport({ targetType, targetId, targetLabel, reason, details }) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    throw new Error('You must be signed in to submit a report.');
  }

  const { error } = await supabase.from('reports').insert({
    reporter_user_id: user.id,
    target_type: targetType,
    target_id: String(targetId),
    target_label: targetLabel || null,
    reason,
    details: details?.trim() || null,
    status: 'PENDING',
  });

  if (error) {
    throw new Error(error.message || 'Failed to submit report.');
  }

  return { success: true };
}
