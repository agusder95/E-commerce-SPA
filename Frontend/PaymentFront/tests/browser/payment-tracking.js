// Evaluate in a dedicated agent-browser session on the local frontend.
// All /api/ responses are simulated; no payment provider or real account is used.
(async () => {
  if (!['127.0.0.1', 'localhost'].includes(location.hostname)) throw new Error('Run this check on localhost only.');
  const originalFetch = window.fetch;
  const originalOpen = window.open;
  const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  const onlineDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
  const savedStorage = { ...localStorage };
  const calls = []; const passed = []; const orders = new Map();
  let visibility = 'visible'; let online = true; let purchases = []; let opened = 0;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const assert = (condition, label) => { if (!condition) throw new Error(label); passed.push(label); };
  const waitFor = async (condition, label) => {
    const until = Date.now() + 5000;
    while (!condition()) { if (Date.now() >= until) throw new Error(label); await sleep(25); }
  };
  const emitReceipts = () => window.dispatchEvent(new Event('paymentfront:checkouts-changed'));
  const statusCalls = () => calls.filter(call => /^\/api\/Order\//i.test(call.path));
  const logout = () => {
    for (const key of ['token', 'email', 'session.lastActivity']) localStorage.removeItem(key);
    window.dispatchEvent(new Event('session-changed'));
  };
  const login = id => {
    const claims = { idCustomer: String(id), role: 'customer', exp: Math.floor(Date.now() / 1000) + 3600 };
    localStorage.setItem('token', `e30.${btoa(JSON.stringify(claims))}.qa`);
    localStorage.setItem('email', 'qa@example.invalid'); localStorage.setItem('session.lastActivity', String(Date.now()));
    window.dispatchEvent(new Event('session-changed'));
  };
  const navigate = path => { history.pushState(null, '', path); window.dispatchEvent(new PopStateEvent('popstate')); };
  const receipt = (id, customerId, itemId = 1) => ({ orderId: id, customerId: String(customerId),
    items: [{ id: itemId, quantity: 1, cartEntryId: `qa-entry-${itemId}` }] });
  const seedCart = () => {
    localStorage.setItem('paymentfront.cart', JSON.stringify([{ id: 1, name: 'QA product', type: 'PHYSICAL',
      price: 100, stock: 2, quantity: 1, cartEntryId: 'qa-entry-1' }]));
    window.dispatchEvent(new StorageEvent('storage', { key: 'paymentfront.cart', storageArea: localStorage }));
  };
  const makeOrder = (id, status = 'PENDING_PAYMENT', expiresAt = Date.now() + 20 * 60000) => ({ idOrder: id,
    status, totalAmount: 100, datePurchase: new Date().toISOString(), expiresAt: new Date(expiresAt).toISOString(),
    mercadoPagoPreferenceId: 'qa-no-real-payment' });
  const purchase = id => ({ orderId: id, status: 'APPROVED', createdAt: new Date().toISOString(), subtotal: 100,
    discountAmount: 0, totalAmount: 100, items: [{ orderItemId: 1, productName: 'QA product', productType: 'PHYSICAL',
      quantity: 1, originalUnitPrice: 100, finalUnitPrice: 100, lineTotal: 100, files: [] }] });

  try {
    logout(); await sleep(50); localStorage.clear(); navigate('/auth');
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
    window.open = () => { opened++; return { opener: null, location: { replace() {} } }; };
    window.fetch = async (url, options = {}) => {
      const path = new URL(String(url), location.href).pathname;
      if (!path.startsWith('/api/')) return originalFetch.call(window, url, options);
      const token = new Headers(options.headers).get('Authorization');
      const customerId = token ? JSON.parse(atob(token.split('.')[1])).idCustomer : null;
      calls.push({ path, method: options.method || 'GET', customerId, at: Date.now() });
      let body = []; let status = 200;
      if (/^\/api\/Order\/\d+$/i.test(path)) {
        body = orders.get(Number(path.split('/').at(-1)));
        if (!body) { status = 404; body = { message: 'Order not found' }; }
      } else if (path === '/api/orders/my-purchases') body = purchases;
      else if (path.includes('sync-payment')) throw new Error('Frontend must not synchronize the provider.');
      return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    };

    seedCart(); orders.set(42, makeOrder(42)); orders.set(99, makeOrder(99));
    localStorage.setItem('paymentfront.checkouts', JSON.stringify([receipt(42, 7), receipt(99, 8, 2)]));
    emitReceipts(); await sleep(50);
    assert(statusCalls().length === 0, 'No payment polling without a session');
    login(7); await waitFor(() => statusCalls().length === 1, 'First pending order read');
    navigate('/checkout/result?orderId=42');
    await waitFor(() => document.body.innerText.includes('Esperando tu pago'), 'Pending result page');
    await sleep(100);
    assert(statusCalls().length === 1 && statusCalls()[0].path === '/api/Order/42', 'Cart and result share the initial request for the current customer');

    visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange'));
    const beforeHidden = statusCalls().length; await sleep(3300);
    assert(statusCalls().length === beforeHidden, 'Hidden page pauses scheduled polling');
    visibility = 'visible';
    for (const event of ['visibilitychange', 'focus', 'pageshow'])
      (event === 'visibilitychange' ? document : window).dispatchEvent(new Event(event));
    await waitFor(() => statusCalls().length > beforeHidden, 'Refresh on return'); await sleep(100);
    assert(statusCalls().length === beforeHidden + 1, 'Returning focus events produce a single immediate refresh');
    online = false; window.dispatchEvent(new Event('offline'));
    const beforeOffline = statusCalls().length; await sleep(3300);
    assert(statusCalls().length === beforeOffline, 'Offline browser pauses scheduled polling');
    online = true; window.dispatchEvent(new Event('online'));
    await waitFor(() => statusCalls().length > beforeOffline, 'Refresh on reconnection');
    assert(statusCalls().length === beforeOffline + 1, 'Reconnection refreshes the pending order once');

    orders.get(42).status = 'CANCELLED'; window.dispatchEvent(new Event('focus'));
    await waitFor(() => document.body.innerText.includes('La orden fue cancelada.'), 'Cancelled result');
    assert(JSON.parse(localStorage.getItem('paymentfront.checkouts')).find(record => record.orderId === 42).trackingStopped,
      'Cancelled receipt stops tracking and preserves its quantities');
    assert(JSON.parse(localStorage.getItem('paymentfront.cart')).length === 1, 'Cancellation preserves the cart');
    const afterCancel = statusCalls().length; await sleep(3300);
    assert(statusCalls().length === afterCancel, 'Cancelled order does not keep polling');

    purchases = [purchase(42)]; navigate('/my-purchases');
    await waitFor(() => localStorage.getItem('paymentfront.cart') === null, 'Late approval settles archived receipt');
    assert(!JSON.parse(localStorage.getItem('paymentfront.checkouts')).some(record => record.orderId === 42),
      'A late approval viewed in purchases settles the cart and removes only its own receipt');
    const beforeSwitch = statusCalls().length;
    purchases = []; login(8); await waitFor(() => statusCalls().length > beforeSwitch, 'New account tracking');
    assert(statusCalls().at(-1).path === '/api/Order/99' && statusCalls().at(-1).customerId === '8',
      'Switching accounts tracks only the new customer orders');
    await waitFor(() => !document.body.innerText.includes('Compra #42'), 'Purchases are reloaded for the new customer');
    assert(!document.body.innerText.includes('Compra #42'), 'Account changes cannot retain another customer purchase list');
    logout(); await sleep(100); const afterLogout = statusCalls().length; await sleep(3300);
    assert(statusCalls().length === afterLogout && location.pathname === '/auth', 'Logout stops requests and protects the results route');

    seedCart(); orders.set(43, makeOrder(43, 'REJECTED'));
    localStorage.setItem('paymentfront.checkouts', JSON.stringify([receipt(43, 7)]));
    login(7); navigate('/checkout/result?orderId=43');
    await waitFor(() => document.body.innerText.includes('Pago rechazado'), 'Rejected result');
    const retry = [...document.querySelectorAll('button')].find(button => button.textContent.includes('Abrir Mercado Pago'));
    assert(Boolean(retry), 'Unexpired rejected payment can be retried'); retry.click();
    await waitFor(() => document.body.innerText.includes('Esperando tu pago'), 'Retry continues observing the prior rejection');
    assert(opened === 1 && !JSON.parse(localStorage.getItem('paymentfront.checkouts'))[0].trackingStopped,
      'Explicit retry resumes the shared tracking without creating another order');
    orders.get(43).status = 'PAYMENT_PROCESSING'; window.dispatchEvent(new Event('focus'));
    await waitFor(() => document.body.innerText.includes('Pago en proceso'), 'Processing after retry');
    purchases = [purchase(43)]; orders.get(43).status = 'APPROVED'; window.dispatchEvent(new Event('focus'));
    await waitFor(() => document.body.innerText.includes('Pago aprobado'), 'Approved after retry');
    assert(localStorage.getItem('paymentfront.cart') === null && localStorage.getItem('paymentfront.checkouts') === null,
      'Confirmed payment settles the shared cart exactly once');
    await waitFor(() => location.pathname === '/my-purchases', 'Automatic purchases redirect');

    orders.set(44, makeOrder(44, 'REJECTED', Date.now() - 1000)); navigate('/checkout/result?orderId=44');
    await waitFor(() => document.body.innerText.includes('Pago rechazado'), 'Expired rejected result');
    assert(![...document.querySelectorAll('button')].some(button => button.textContent.includes('Abrir Mercado Pago')),
      'Expired preferences cannot be reopened');
    navigate('/checkout/result?orderId=404');
    await waitFor(() => document.body.innerText.includes('No encontramos este pedido'), 'Unavailable order result');
    assert(!document.querySelector('.spinner'), 'Unavailable orders show an error and stop the waiting spinner');
    assert(calls.every(call => call.method === 'GET' && !call.path.includes('sync-payment')),
      'Frontend status tracking never forces provider synchronization');
    window.paymentQAReport = { passed, paymentRequests: statusCalls().length, providerSyncRequests: 0 };
    return window.paymentQAReport;
  } finally {
    logout(); await sleep(50);
    window.fetch = originalFetch; window.open = originalOpen;
    if (visibilityDescriptor) Object.defineProperty(document, 'visibilityState', visibilityDescriptor);
    else delete document.visibilityState;
    if (onlineDescriptor) Object.defineProperty(navigator, 'onLine', onlineDescriptor);
    else delete navigator.onLine;
    localStorage.clear();
    for (const [key, value] of Object.entries(savedStorage)) localStorage.setItem(key, value);
  }
})()
