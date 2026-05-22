import { supabase } from '../../shared/services/supabaseClient';
import { clearAdminViewMode } from '../hooks/useAdminViewMode';

/**
 * Resolves app role for the authenticated user.
 * @param {import('@supabase/supabase-js').User} authUser
 * @returns {Promise<string>} Uppercase role or empty string
 */
export async function resolveUserRole(authUser) {
  let resolvedRole = '';

  if (authUser?.id) {
    const { data: userProfile, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('auth_user_id', authUser.id)
      .maybeSingle();

    if (!roleError && userProfile?.role) {
      resolvedRole = userProfile.role;
    }
  }

  if (!resolvedRole) {
    const metaRole = authUser?.app_metadata?.role || authUser?.user_metadata?.role;
    if (metaRole) {
      resolvedRole = metaRole;
    }
  }

  if (!resolvedRole && authUser?.email) {
    const { data: userProfileByEmail, error: emailError } = await supabase
      .from('users')
      .select('role')
      .eq('email', authUser.email)
      .maybeSingle();

    if (!emailError && userProfileByEmail?.role) {
      resolvedRole = userProfileByEmail.role;
    }
  }

  return String(resolvedRole || '').trim().toUpperCase();
}

/**
 * Role-based navigation after a verified session exists.
 * @param {import('@supabase/supabase-js').Session} session
 * @param {(path: string, options?: object) => void} navigate
 * @returns {Promise<'ok' | 'banned'>}
 */
export async function completeAuthRedirect(session, navigate) {
  const authUser = session?.user;
  const normalizedRole = await resolveUserRole(authUser);

  if (normalizedRole === 'BANNED') {
    await supabase.auth.signOut();
    return 'banned';
  }

  const redirectPath = normalizedRole === 'ADMIN' ? '/admin' : '/home';
  if (redirectPath !== '/admin') {
    clearAdminViewMode();
  }
  navigate(redirectPath, { replace: true });
  return 'ok';
}
