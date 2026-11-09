import { useCallback, useEffect, useState } from 'react';

/** Runs an async loader on mount and whenever deps change. */
export default function useLoad(loader, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setData(await run()); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [run]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    run().then((d) => !cancelled && setData(d)).catch((e) => !cancelled && setError(e.message)).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [run]);

  return { data, error, loading, reload, setData };
}
