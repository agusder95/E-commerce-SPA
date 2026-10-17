import { useCallback, useState } from 'react';
import { getAdminDashboard } from '../api/admin';
import useResource from '../../../shared/hooks/useResource';
import { presetRange, statisticsError } from '../model/statistics.js';

export default function useAdminDashboard() {
  const [draft, setDraft] = useState(() => presetRange('1'));
  const [query, setQuery] = useState(draft);
  const [validation, setValidation] = useState('');
  const [revision, setRevision] = useState(0);
  const loader = useCallback(options => { void revision; return getAdminDashboard(query, options); }, [query, revision]);
  const resource = useResource(loader);
  function preset(value) {
    const range = presetRange(value);
    setDraft(range); setQuery(range); setValidation(''); setRevision(value => value + 1);
  }
  function apply(event) {
    event.preventDefault();
    const error = statisticsError({ ...draft, productId: 'overview' });
    setValidation(error);
    if (!error) { setQuery({ ...draft }); setRevision(value => value + 1); }
  }
  return { ...resource, draft, query, validation, preset, apply,
    dirty: draft.from !== query.from || draft.to !== query.to,
    change: (key, value) => { setDraft(previous => ({ ...previous, [key]: value })); setValidation(''); },
    retry: () => setRevision(value => value + 1) };
}
