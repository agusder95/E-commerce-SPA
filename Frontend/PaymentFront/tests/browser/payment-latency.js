// Isolated agent-browser localhost check. All API traffic is simulated; no provider is contacted.
(async () => {
  if (!['localhost', '127.0.0.1'].includes(location.hostname)) throw Error('Local checks only');
  const originalFetch = window.fetch, savedStorage = { ...localStorage };
  const calls = [], checks = [];
  const pause = () => new Promise(resolve => setTimeout(resolve, 50));
  const check = (ok, label) => { if (!ok) throw Error(label); checks.push(label); };
  const waitFor = async condition => { for (let i = 0; i < 100; i++) { if (condition()) return; await pause(); } throw Error('Browser scenario timed out'); };
  const navigate = path => { history.pushState(null, '', path); dispatchEvent(new PopStateEvent('popstate')); };
  const response = status => new Response(JSON.stringify({ idOrder: 42, status, totalAmount: 100, live: true,
    expiresAt: new Date(Date.now() + 20 * 60000).toISOString(), mercadoPagoPreferenceId: 'test-only' }), { headers: { 'Content-Type': 'application/json' } });
  let release;
  try {
    window.fetch = async (url, options = {}) => {
      const request = new URL(String(url), location.href);
      if (!request.pathname.startsWith('/api/')) return originalFetch.call(window, url, options);
      calls.push({ path: request.pathname, method: options.method || 'GET', query: request.search });
      if (request.pathname.endsWith('/recover-payment')) return new Response(null, { status: 204 });
      if (/^\/api\/order\/42$/i.test(request.pathname)) {
        if (request.searchParams.get('afterStatus')) return new Promise((resolve, reject) => {
          release = status => resolve(response(status));
          options.signal?.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
        });
        return response('PENDING_PAYMENT');
      }
      return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
    };
    localStorage.clear();
    const claims = { idCustomer: '7', role: 'customer', exp: Math.floor(Date.now() / 1000) + 3600 };
    localStorage.setItem('token', `e30.${btoa(JSON.stringify(claims))}.qa`);
    localStorage.setItem('email', 'qa@example.invalid'); localStorage.setItem('session.lastActivity', String(Date.now()));
    dispatchEvent(new Event('session-changed'));
    navigate('/checkout/result?orderId=42&payment_id=999&status=approved');
    await waitFor(() => !!release && document.body.innerText.includes('Esperando tu pago'));
    check(document.body.innerText.includes('Esperando tu pago'), 'Return parameters cannot approve a payment');
    const reads = () => calls.filter(c => /^\/api\/order\/42$/i.test(c.path));
    check(reads().length === 2 && reads()[1].query.includes('afterStatus=PENDING_PAYMENT'), 'Tracker starts one long status wait after the first live snapshot');
    for (let i = 0; i < 5; i++) dispatchEvent(new Event('focus'));
    await pause(); await pause();
    check(calls.filter(c => c.path.endsWith('/recover-payment')).length === 1, 'Checkout return and repeated focus events enqueue recovery once per mounted order');
    check(reads().length === 2, 'Repeated focus does not multiply an in-flight live status request');
    check(document.querySelector('.result-actions .btn-primary')?.disabled, 'Payment reopen cooldown remains independent of status recovery');
    release('APPROVED');
    await waitFor(() => document.body.innerText.includes('Pago aprobado'));
    check(reads().length === 2 && document.body.innerText.includes('Pago aprobado'), 'Persisted approval reaches the UI immediately through the waiting request');
    check(!calls.some(c => c.path.includes('sync-payment')), 'Browser never forces a synchronous provider lookup');
    return { passed: checks.length, checks };
  } finally {
    navigate('/about'); await pause(); window.fetch = originalFetch;
    localStorage.clear(); for (const [key, value] of Object.entries(savedStorage)) localStorage.setItem(key, value);
    dispatchEvent(new Event('session-changed'));
  }
})();
