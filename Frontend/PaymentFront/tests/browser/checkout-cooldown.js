// Run with agent-browser eval --stdin on an isolated local frontend session.
// API calls and payment tabs are simulated. Clock advancement exercises the real React UI.
(async () => {
  if (!['127.0.0.1', 'localhost'].includes(location.hostname)) throw Error('Local checks only');
  const originalFetch = window.fetch, originalOpen = window.open, originalNow = Date.now;
  const savedStorage = { ...localStorage };
  let offset = 0, opened = 0, blockPopup = false;
  const passed = [];
  const pause = () => new Promise(resolve => setTimeout(resolve, 100));
  const check = (ok, label) => { if (!ok) throw Error(label); passed.push(label); };
  const navigate = path => { history.pushState(null, '', path); dispatchEvent(new PopStateEvent('popstate')); };
  const advance = async ms => { offset += ms; dispatchEvent(new Event('focus')); await pause(); };
  const button = () => document.querySelector('.result-actions .btn-primary');
  try {
    Date.now = () => originalNow() + offset;
    window.open = () => { opened++; return blockPopup ? null : { opener: null, location: { replace() {} } }; };
    window.fetch = async (url, options) => {
      const path = new URL(String(url), location.href).pathname;
      if (!path.startsWith('/api/')) return originalFetch.call(window, url, options);
      const id = Number(path.split('/').at(-1));
      const result = /^\/api\/Order\/\d+$/i.test(path) ? { idOrder: id, status: 'PENDING_PAYMENT', totalAmount: 100,
        expiresAt: new Date(originalNow() + 20 * 60000).toISOString(), mercadoPagoPreferenceId: 'simulated-no-real-payment' } : [];
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    };
    localStorage.clear();
    const claims = { idCustomer: '7', role: 'customer', exp: Math.floor(originalNow() / 1000) + 3600 };
    localStorage.setItem('token', `e30.${btoa(JSON.stringify(claims))}.qa`);
    localStorage.setItem('email', 'qa@example.invalid'); localStorage.setItem('session.lastActivity', String(Date.now()));
    dispatchEvent(new Event('session-changed'));
    navigate('/checkout/result?orderId=42');
    for (let i = 0; i < 50 && !button(); i++) await pause();
    check(button()?.disabled && button().textContent.includes('30s'), 'Button starts disabled for 30 seconds');
    button().click(); check(opened === 0, 'Disabled button cannot open a payment tab');
    await advance(29000); check(button().disabled && button().textContent.includes('1s'), 'Button stays disabled before the 30-second deadline');
    await advance(1000); check(!button().disabled, 'Button enables at the deadline after returning to the tab');
    button().click(); button().click(); await pause();
    check(opened === 1 && button().disabled && button().textContent.includes('30s'), 'One click opens one tab and immediately restarts the cooldown');
    await advance(29000); check(button().disabled, 'Repeated use requires another complete wait');
    await advance(1000); check(!button().disabled, 'Button re-enables after the second deadline');
    blockPopup = true; button().click(); await pause();
    check(opened === 2 && button().disabled && document.querySelector('[role="alert"]')?.textContent.includes('Permití abrir'),
      'Blocked popup still restarts the cooldown and retains the existing error message');
    await advance(30000); check(!button().disabled, 'Button recovers after a blocked-popup attempt');
    navigate('/checkout/result?orderId=43'); await pause();
    check(button()?.disabled && button().textContent.includes('30s'), 'A different order starts its own initial cooldown');
    return { passed: passed.length, checks: passed };
  } finally {
    navigate('/about'); await pause();
    window.fetch = originalFetch; window.open = originalOpen; Date.now = originalNow;
    localStorage.clear(); for (const [key, value] of Object.entries(savedStorage)) localStorage.setItem(key, value);
    dispatchEvent(new Event('session-changed'));
  }
})();
