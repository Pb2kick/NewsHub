import { useCallback, useEffect, useState } from 'react';

/**
 * Loads async data with built-in loading/error/reload state.
 * @template T
 * @param {() => Promise<T>} loader
 * @param {Array<any>} deps
 * @returns {{ data: T | null, loading: boolean, error: string, reload: () => Promise<void> }}
 */
export function useAdminResource(loader, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /** Triggers a fresh data load while preserving stable callback identity. */
  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await loader();
      setData(next);
    } catch (loadError) {
      setError(loadError?.message || 'Unable to load resource.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [loader]);

  const depsSignature = JSON.stringify(deps);

  useEffect(() => {
    reload();
  }, [reload, depsSignature]);

  return { data, loading, error, reload };
}
