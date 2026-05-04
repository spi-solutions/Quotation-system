/**
 * API test script
 *
 * Run: node test-apis.js
 * Requires: dev server running (npm run dev)
 * If dev runs on a different port: API_BASE=http://localhost:3001 node test-apis.js
 *
 * Loads .env.local from project root (optional).
 *
 * For all tests to pass:
 * 1. Run Supabase migrations and set .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SESSION_SECRET
 * 2. Create an admin (npm run create:admin) or set API_TEST_ADMIN_EMAIL + API_TEST_ADMIN_PASSWORD
 *    (defaults to admin@quote.local / Admin@123 if unset — local smoke only).
 */
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const envPath = path.join(root, '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    const m = trimmed.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  });
}

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

  // 1. Auth signup (or login if user already exists from a prior run)
  let r = await request('/api/auth/signup', getOpts({ email: 'apitest@example.com', password: 'pass123' }));
  cookies = r.headers.get('set-cookie') || cookies;
  const signupOk =
    r.ok ||
    (typeof r.data?.error === 'string' &&
      r.data.error.toLowerCase().includes('already exists'));
  assert(
    signupOk,
    'POST /api/auth/signup',
    r.timeout ? '(timeout)' : r.ok ? '' : r.data?.error || r.status
  );
  if (!r.ok && r.status === 500) {
    console.log('   (500: ensure app schema is created, exposed in Supabase API settings, and env vars set)');
    if (r.data && typeof r.data === 'object' && r.data.error) {
      console.log('   Error:', r.data.error);
      if (r.data.code) console.log('   Code:', r.data.code);
      if (r.data.cause) console.log('   Cause:', r.data.cause);
    } else if (r.text) console.log('   Response:', r.text.slice(0, 200));
  }
  if (!r.ok && typeof r.data?.error === 'string' && r.data.error.includes('already exists')) {
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

  // 5b. Admin session for quote create + admin routes (POST /api/quotes is admin-only)
  const adminEmail =
    process.env.API_TEST_ADMIN_EMAIL ||
    process.env.ADMIN_EMAIL ||
    'admin@quote.local';
  const adminPassword =
    process.env.API_TEST_ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    'Admin@123';
  const adminLogin = await request(
    '/api/auth/login',
    getOpts({ email: adminEmail, password: adminPassword })
  );
  let adminCookies = '';
  if (adminLogin.ok) {
    adminCookies = adminLogin.headers.get('set-cookie') || '';
    console.log('   (admin session:', adminEmail, ')');
  } else {
    console.log(
      '   (admin login failed — quote POST / admin GETs may fail:',
      adminLogin.data?.error || adminLogin.status,
      ')'
    );
  }
  const ac = adminCookies || cookies;

  // 6. Quotes (requires admin cookie)
  r = await request('/api/quotes', { method: 'GET', headers: { Cookie: ac } });
  assert(r.ok, 'GET /api/quotes', r.timeout ? '(timeout)' : (Array.isArray(r.data?.data) ? `(${r.data.data.length} items)` : r.data?.error));

  const products = (await request('/api/products', { method: 'GET', headers: { Cookie: ac } })).data?.data || [];
  const fabricGroups = (await request('/api/fabric-groups', { method: 'GET', headers: { Cookie: ac } })).data?.data || [];
  const productId = products[0]?.id;
  const fabricGroupId = fabricGroups[0]?.id;
  if (productId && fabricGroupId) {
    r = await request('/api/quotes', {
      method: 'POST',
      headers: { Cookie: ac, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { name: 'Quote Customer', email: 'quotecust@test.com' },
        additionalInfo: 'API smoke test quote',
        etaText: 'Blinds 2-3 wks',
        productId,
        fabricGroupId,
        inputWidth: 100,
        inputDrop: 200,
        quantity: 2,
      }),
    });
    assert(r.ok, 'POST /api/quotes', r.timeout ? '(timeout)' : (r.data?.error || (r.data?.data?.quote?.id ? `(id ${r.data.data.quote.id})` : '')));
    const quoteId = r.data?.data?.quote?.id;
    if (quoteId) {
      r = await request(`/api/quotes/${quoteId}`, { method: 'GET', headers: { Cookie: ac } });
      assert(r.ok, 'GET /api/quotes/:id', r.timeout ? '(timeout)' : r.data?.error);
      // POST /api/quotes already sets Sent (or EmailFailed); next valid step is Approved, not Sent again
      const currentStatus = r.data?.data?.status;
      const nextStatus =
        currentStatus === 'EmailFailed'
          ? 'Sent'
          : currentStatus === 'Sent' || currentStatus === 'EmailQueued'
            ? 'Approved'
            : 'Sent';
      r = await request(`/api/quotes/${quoteId}/status`, {
        method: 'PATCH',
        headers: { Cookie: ac, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      assert(r.ok, 'PATCH /api/quotes/:id/status', r.timeout ? '(timeout)' : r.data?.error);
    }
  } else {
    assert(false, 'POST /api/quotes', '(skip: no products/fabric groups in DB)');
  }

  // 7. Admin (expect 200 with admin session)
  r = await request('/api/admin/products', { method: 'GET', headers: { Cookie: ac } });
  assert(r.ok, 'GET /api/admin/products', r.timeout ? '(timeout)' : (r.data?.error || ''));

  r = await request('/api/admin/fabric-groups', { method: 'GET', headers: { Cookie: ac } });
  assert(r.ok, 'GET /api/admin/fabric-groups', r.timeout ? '(timeout)' : (r.data?.error || ''));

  r = await request('/api/admin/widths', { method: 'GET', headers: { Cookie: ac } });
  assert(r.ok, 'GET /api/admin/widths', r.timeout ? '(timeout)' : (r.data?.error || ''));

  r = await request('/api/admin/drops', { method: 'GET', headers: { Cookie: ac } });
  assert(r.ok, 'GET /api/admin/drops', r.timeout ? '(timeout)' : (r.data?.error || ''));

  r = await request('/api/admin/pricing-grid', { method: 'GET', headers: { Cookie: ac } });
  assert(r.ok, 'GET /api/admin/pricing-grid', r.timeout ? '(timeout)' : (r.data?.error || ''));

  r = await request('/api/admin/costing-rules', { method: 'GET', headers: { Cookie: ac } });
  assert(r.ok, 'GET /api/admin/costing-rules', r.timeout ? '(timeout)' : (r.data?.error || ''));

  // 8. Logout
  r = await request('/api/auth/logout', { method: 'POST', headers: { Cookie: ac } });
  assert(r.ok, 'POST /api/auth/logout', r.timeout ? '(timeout)' : '');

  console.log('\n--- Summary ---');
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  console.log('--- Done ---\n');
}

run().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
