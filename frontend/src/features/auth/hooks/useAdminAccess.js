import { useEffect, useState } from 'react';
import { supabase } from '../../shared/services/supabaseClient';

const ADMIN_ROLE = 'ADMIN';

/**
 * Resolves admin access from auth metadata and profile table.
 * @returns {{ loading: boolean, isAuthenticated: boolean, isAdmin: boolean, user: any, profileRole: string, error: string }}
 */
export function useAdminAccess() {
  const [state, setState] = useState({
    loading: true,
    isAuthenticated: false,
    isAdmin: false,
    user: null,
    profileRole: '',
    error: '',
  });

  useEffect(() => {
    let isMounted = true;

    /** Loads and merges auth-role plus table-role checks. */
    async function loadAccess() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          if (isMounted) {
            setState({
              loading: false,
              isAuthenticated: false,
              isAdmin: false,
              user: null,
              profileRole: '',
              error: sessionError?.message || '',
            });
          }
          return;
        }

        const authUser = session.user;
        let profileRole = '';

        const { data: userProfile, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('email', authUser.email)
          .maybeSingle();

        if (!userError && userProfile?.role) {
          profileRole = userProfile.role;
        }

        const isAdmin = String(profileRole || '').trim().toUpperCase() === ADMIN_ROLE;

        if (isMounted) {
          setState({
            loading: false,
            isAuthenticated: true,
            isAdmin,
            user: authUser,
            profileRole,
            error: '',
          });
        }
      } catch (error) {
        if (isMounted) {
          setState({
            loading: false,
            isAuthenticated: false,
            isAdmin: false,
            user: null,
            profileRole: '',
            error: error?.message || 'Unable to validate admin access.',
          });
        }
      }
    }

    loadAccess();
    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}
