/**
 * API test script
 *
 * Run: node test-apis.js
 * Requires: dev server running (npm run dev)
 * If dev runs on a different port: API_BASE=http://localhost:3001 node test-apis.js
 *
 * For all tests to pass:
 * 1. Run Supabase migrations and expose "app" schema in Supabase Dashboard → API settings
 * 2. Set .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SESSION_SECRET
 * 3. Admin tests will 403 unless you log in as a user with role=admin
 */
const BASE = process.env.API_BASE || 'http://localhost:3000';
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS) || 65000;

async function request(path, opts = {}) {
  const url = BASE + path;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...opts.headers },
    });
    clearTimeout(timeoutId);
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { ok: res.ok, status: res.status, data, headers: res.headers, text };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { ok: false, status: 0, data: null, headers: new Headers(), text: '', timeout: true };
    }
    const msg = err.cause ? `${err.message} (${err.cause.message || err.cause})` : err.message;
    return { ok: false, status: 0, data: { error: msg }, headers: new Headers(), text: msg };
  }
}

const log = (label, ok, detail) => {
  const status = ok ? '✓' : '✗';
  console.log(`${status} ${label}${detail ? ' ' + detail : ''}`);
};

async function run() {
  console.log('\n--- API Tests ---\n');
  console.log('Base URL:', BASE, '\n');
  let cookies = '';
  let passed = 0;
  let failed = 0;
  const assert = (ok, label, detail) => {
    if (ok) passed++; else failed++;
    log(label, ok, detail);
  };
  const getOpts = (body, method = 'POST') => {
    const opts = { method };
    if (body) opts.body = JSON.stringify(body);
    if (cookies) opts.headers = { Cookie: cookies };
    return opts;
  };

  // 1. Auth signup
  let r = await request('/api/auth/signup', getOpts({ email: 'apitest@example.com', password: 'pass123' }));
  cookies = r.headers.get('set-cookie') || cookies;
  assert(r.ok, 'POST /api/auth/signup', r.timeout ? '(timeout)' : (r.ok ? '' : (r.data?.error || r.status)));
  if (!r.ok && r.status === 500) {
    console.log('   (500: ensure app schema is created, exposed in Supabase API settings, and env vars set)');
    if (r.data && typeof r.data === 'object' && r.data.error) {
      console.log('   Error:', r.data.error);
      if (r.data.code) console.log('   Code:', r.data.code);
      if (r.data.cause) console.log('   Cause:', r.data.cause);
    } else if (r.text) console.log('   Response:', r.text.slice(0, 200));
  }
  if (!r.ok && r.data?.error?.includes('already exists')) {
    r = await request('/api/auth/login', getOpts({ email: 'apitest@example.com', password: 'pass123' }));
    cookies = r.headers.get('set-cookie') || cookies;
    assert(r.ok, 'POST /api/auth/login (existing user)', r.timeout ? '(timeout)' : '');
  }

  // 2. Auth me
  r = await request('/api/auth/me', { method: 'GET', headers: { Cookie: cookies } });
  assert(r.ok, 'GET /api/auth/me', r.timeout ? '(timeout)' : (r.data?.data?.user?.email || r.data?.error));

  // 2b. Login with bad password (expect 401)
  const badLogin = await request('/api/auth/login', getOpts({ email: 'apitest@example.com', password: 'wrong' }));
  assert(badLogin.status === 401, 'POST /api/auth/login (bad password → 401)', '');

  // 3. Profile
  r = await request('/api/profile', { method: 'GET', headers: { Cookie: cookies } });
  assert(r.ok || r.status === 404, 'GET /api/profile', r.timeout ? '(timeout)' : (r.status === 404 ? '(no profile yet)' : ''));

  r = await request('/api/profile', getOpts({ name: 'API Test', email: 'apitest@example.com', phone: '123' }, 'PATCH'));
  assert(r.ok, 'PATCH /api/profile', r.timeout ? '(timeout)' : r.data?.error);

  // 4. Catalog
  r = await request('/api/products', { method: 'GET', headers: { Cookie: cookies } });
  assert(r.ok, 'GET /api/products', r.timeout ? '(timeout)' : (Array.isArray(r.data?.data) ? `(${r.data.data.length} items)` : r.data?.error));

  r = await request('/api/fabric-groups', { method: 'GET', headers: { Cookie: cookies } });
  assert(r.ok, 'GET /api/fabric-groups', r.timeout ? '(timeout)' : (Array.isArray(r.data?.data) ? `(${r.data.data.length} items)` : r.data?.error));

  // 5. Customers (send cookies for consistency)
  r = await request('/api/customers', { method: 'GET', headers: { Cookie: cookies } });
  assert(r.ok, 'GET /api/customers', r.timeout ? '(timeout)' : (Array.isArray(r.data?.data) ? `(${r.data.data.length} items)` : (r.data?.error || r.status)));
  if (!r.ok && r.status === 500) {
    console.log('   (500: ensure app.customers table exists)');
    if (r.data && typeof r.data === 'object' && r.data.error) console.log('   Error:', r.data.error);
  }

  r = await request('/api/customers', getOpts({ name: 'Customer One', email: 'customer1@test.com' }));
  assert(r.ok, 'POST /api/customers', r.timeout ? '(timeout)' : r.data?.error);
  if (!r.ok && r.status === 500) {
    console.log('   (500: check app.customers table)');
    if (r.data && typeof r.data === 'object' && r.data.error) console.log('   Error:', r.data.error);
  }

  // 6. Quotes
  r = await request('/api/quotes', { method: 'GET', headers: { Cookie: cookies } });
  assert(r.ok, 'GET /api/quotes', r.timeout ? '(timeout)' : (Array.isArray(r.data?.data) ? `(${r.data.data.length} items)` : r.data?.error));

  const products = (await request('/api/products', { method: 'GET', headers: { Cookie: cookies } })).data?.data || [];
  const fabricGroups = (await request('/api/fabric-groups', { method: 'GET', headers: { Cookie: cookies } })).data?.data || [];
  const productId = products[0]?.id;
  const fabricGroupId = fabricGroups[0]?.id;
  if (productId && fabricGroupId) {
    r = await request('/api/quotes', getOpts({
      customer: { name: 'Quote Customer', email: 'quotecust@test.com' },
      additionalInfo: 'API smoke test quote',
      etaText: 'Blinds 2-3 wks',
      productId,
      fabricGroupId,
      inputWidth: 100,
      inputDrop: 200,
      quantity: 2,
    }));
    assert(r.ok, 'POST /api/quotes', r.timeout ? '(timeout)' : (r.data?.error || (r.data?.data?.quote?.id ? `(id ${r.data.data.quote.id})` : '')));
    const quoteId = r.data?.data?.quote?.id;
    if (quoteId) {
      r = await request(`/api/quotes/${quoteId}`, { method: 'GET', headers: { Cookie: cookies } });
      assert(r.ok, 'GET /api/quotes/:id', r.timeout ? '(timeout)' : r.data?.error);
      r = await request(`/api/quotes/${quoteId}/status`, getOpts({ status: 'Sent' }, 'PATCH'));
      assert(r.ok, 'PATCH /api/quotes/:id/status', r.timeout ? '(timeout)' : r.data?.error);
    }
  } else {
    assert(false, 'POST /api/quotes', '(skip: no products/fabric groups in DB)');
  }

  // 7. Admin (403 if not admin)
  r = await request('/api/admin/products', { method: 'GET', headers: { Cookie: cookies } });
  assert(r.ok || r.status === 403, 'GET /api/admin/products', r.timeout ? '(timeout)' : (r.status === 403 ? '(403 not admin)' : (r.data?.error || '')));

  r = await request('/api/admin/fabric-groups', { method: 'GET', headers: { Cookie: cookies } });
  assert(r.ok || r.status === 403, 'GET /api/admin/fabric-groups', r.timeout ? '(timeout)' : (r.status === 403 ? '(403)' : ''));

  r = await request('/api/admin/widths', { method: 'GET', headers: { Cookie: cookies } });
  assert(r.ok || r.status === 403, 'GET /api/admin/widths', r.timeout ? '(timeout)' : (r.status === 403 ? '(403)' : ''));

  r = await request('/api/admin/drops', { method: 'GET', headers: { Cookie: cookies } });
  assert(r.ok || r.status === 403, 'GET /api/admin/drops', r.timeout ? '(timeout)' : (r.status === 403 ? '(403)' : ''));

  r = await request('/api/admin/pricing-grid', { method: 'GET', headers: { Cookie: cookies } });
  assert(r.ok || r.status === 403, 'GET /api/admin/pricing-grid', r.timeout ? '(timeout)' : (r.status === 403 ? '(403)' : ''));

  r = await request('/api/admin/costing-rules', { method: 'GET', headers: { Cookie: cookies } });
  assert(r.ok || r.status === 403, 'GET /api/admin/costing-rules', r.timeout ? '(timeout)' : (r.status === 403 ? '(403)' : ''));

  // 8. Logout
  r = await request('/api/auth/logout', { method: 'POST', headers: { Cookie: cookies } });
  assert(r.ok, 'POST /api/auth/logout', r.timeout ? '(timeout)' : '');

  console.log('\n--- Summary ---');
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  console.log('--- Done ---\n');
}

run().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
