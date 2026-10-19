import { useEffect, useState } from 'react';

// The loader must have stable identity (module function or useCallback).
// Ignore stale responses and cancel requests when the view changes or unmounts.
export default function useResource(loader, initialData = null) {
  const [state, setState] = useState({ data: initialData, loading: true, error: '', request: loader });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      setState(previous => ({ ...previous, loading: true, error: '', request: loader }));
      try {
        const data = await loader({ signal: controller.signal });
        if (active) setState({ data, loading: false, error: '', request: loader });
      } catch (error) {
        if (active) setState(previous => ({ ...previous, loading: false, error: error.message }));
      }
    }
    load();
    return () => { active = false; controller.abort(); };
  }, [loader]);
  return { data: state.data, loading: state.request !== loader || state.loading,
    error: state.request === loader ? state.error : '' };
}
