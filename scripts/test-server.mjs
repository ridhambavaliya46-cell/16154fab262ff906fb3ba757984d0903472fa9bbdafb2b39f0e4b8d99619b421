/**
 * End-to-end HTTP test against the real dev server (`tsx server.ts`).
 *
 * The function suite exercises the Netlify bundle; this exercises the exact
 * stack you run locally — Express + Vite middleware over a real socket — and
 * asserts the JSON contract the browser (AuthContext) depends on.
 *
 * Run with: npm run test:server
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.TEST_PORT || 3199);
const BASE = `http://127.0.0.1:${PORT}`;
const START_TIMEOUT_MS = 90_000;

let passed = 0;
const failures = [];
const logs = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function request(method, urlPath, { body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : Buffer.from(body);
    const req = http.request(
      `${BASE}${urlPath}`,
      {
        method,
        headers: {
          host: `127.0.0.1:${PORT}`,
          ...(payload
            ? {
                'content-type': 'application/json',
                'content-length': String(payload.byteLength),
              }
            : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        );
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const json = (res) => {
  try {
    return JSON.parse(res.body);
  } catch {
    return null;
  }
};
const isJson = (res) => String(res.headers['content-type'] || '').includes('application/json');

async function waitForServer(child) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  let lastError = '';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early with code ${child.exitCode}`);
    }
    try {
      const res = await request('GET', '/api/health');
      if (res.status === 200) return;
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err.message;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server did not become healthy within ${START_TIMEOUT_MS}ms (${lastError})`);
}

async function main() {
  console.log(`Starting dev server on ${BASE}…`);
  const child = spawn(path.join(projectRoot, 'node_modules', '.bin', 'tsx'), ['server.ts'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => logs.push(d.toString()));
  child.stderr.on('data', (d) => logs.push(d.toString()));

  const stop = () =>
    new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once('exit', resolve);
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5000).unref();
    });

  try {
    await waitForServer(child);
    console.log('\n[live server]');

    const health = await request('GET', '/api/health');
    check('GET /api/health -> 200', health.status === 200, `got ${health.status}`);
    check('GET /api/health is JSON', isJson(health), String(health.headers['content-type']));
    check('GET /api/health names the service', json(health)?.service === 'resumesetu-api', health.body);
    check('local run is not serverless', json(health)?.serverless === false, health.body);

    const me = await request('GET', '/api/auth/me');
    check('GET /api/auth/me -> 401', me.status === 401, `got ${me.status}`);
    check('GET /api/auth/me is JSON', isJson(me), String(me.headers['content-type']));
    check(
      'GET /api/auth/me error text',
      typeof json(me)?.error === 'string',
      me.body.slice(0, 120)
    );

    const login = await request('POST', '/api/auth/login', { body: '{}' });
    check('POST /api/auth/login (no bearer) -> 401', login.status === 401, `got ${login.status}`);
    check('POST /api/auth/login is JSON', isJson(login), String(login.headers['content-type']));

    const bad = await request('POST', '/api/auth/login', { body: '{bad:}' });
    check('malformed JSON -> 400', bad.status === 400, `got ${bad.status}`);
    check('malformed JSON -> JSON body', isJson(bad), String(bad.headers['content-type']));

    const missing = await request('GET', '/api/not-a-real-route');
    check('unknown /api route -> 404', missing.status === 404, `got ${missing.status}`);
    check('unknown /api route -> JSON 404', isJson(missing), String(missing.headers['content-type']));
    check('unknown /api route is not the SPA shell', !missing.body.includes('<div id="root"'), missing.body.slice(0, 80));

    const index = await request('GET', '/');
    check('GET / -> 200', index.status === 200, `got ${index.status}`);
    check('GET / serves the SPA shell', index.body.includes('<div id="root"'), index.body.slice(0, 80));

    const spaRoute = await request('GET', '/signin');
    check('GET /signin -> 200 SPA shell (no 404)', spaRoute.status === 200 && spaRoute.body.includes('<div id="root"'), `got ${spaRoute.status}`);

    // -----------------------------------------------------------------------
    // Security headers
    // -----------------------------------------------------------------------
    console.log('\n[security headers]');
    const headerSource = index.headers;
    check('X-Content-Type-Options is nosniff', headerSource['x-content-type-options'] === 'nosniff', String(headerSource['x-content-type-options']));
    check('X-Frame-Options denies framing', headerSource['x-frame-options'] === 'DENY', String(headerSource['x-frame-options']));
    check('Referrer-Policy is set', typeof headerSource['referrer-policy'] === 'string', String(headerSource['referrer-policy']));
    check('Permissions-Policy restricts device APIs', typeof headerSource['permissions-policy'] === 'string' && headerSource['permissions-policy'].includes('camera=()'), String(headerSource['permissions-policy']));

    const csp = headerSource['content-security-policy'] || '';
    check('CSP is present', csp.length > 0);
    check("CSP default-src is 'self'", csp.includes("default-src 'self'"), csp);

    /*
     * Clerk serves clerk-js from the instance's own Frontend API host. If the CSP
     * omits it, every sign-in fails in production — and the dev server, which
     * never loads Clerk's bundle, would not notice.
     */
    check(
      'CSP allows the Clerk instance origin',
      /clerk\.accounts\.dev/.test(csp),
      csp
    );
    check(
      'the Clerk origin is permitted for scripts',
      /script-src[^;]*clerk\.accounts\.dev/.test(csp),
      csp
    );
    check(
      'the Clerk origin is permitted for XHR',
      /connect-src[^;]*clerk\.accounts\.dev/.test(csp),
      csp
    );
    check(
      'Google is permitted as an OAuth frame source',
      /frame-src[^;]*accounts\.google\.com/.test(csp),
      csp
    );
    check("CSP forbids object-src", csp.includes("object-src 'none'"), csp);
    check("CSP forbids inline script attributes", csp.includes("script-src-attr 'none'"), csp);
    check('CSP forbids framing via frame-ancestors', csp.includes("frame-ancestors 'none'"), csp);
    check('CSP pins form-action to self', csp.includes("form-action 'self'"), csp);
    // The dev server (Vite HMR) needs 'unsafe-eval'; the SPA shell must never
    // rely on inline <script>, which is the injection-relevant half.
    check('CSP script-src never allows inline scripts', !/script-src[^;]*'unsafe-inline'/.test(csp), csp);
    check('CSP script-src is not wide open', !csp.includes('script-src *'), csp);

    // API responses must carry the headers too, not just HTML routes.
    const apiHealth = await request('GET', '/api/health');
    check('API responses carry nosniff', apiHealth.headers['x-content-type-options'] === 'nosniff');

    // -----------------------------------------------------------------------
    // The encrypted vault must never be served as a static directory
    // -----------------------------------------------------------------------
    console.log('\n[resume vault is not public]');
    // -----------------------------------------------------------------------
    // Authentication is Clerk-only: there must be no first-party credential
    // endpoints left to attack, and the Clerk exchange must not be forgeable.
    // -----------------------------------------------------------------------
    console.log('\n[clerk-only authentication]');

    const removedRoutes = [
      '/api/auth/register',
      '/api/auth/password/login',
      '/api/auth/password/change',
      '/api/auth/password/set',
    ];
    for (const route of removedRoutes) {
      const res = await request('POST', route, {
        body: JSON.stringify({ email: 'attacker@example.com', password: 'a-long-enough-password' }),
      });
      check(`${route} is not a live endpoint`, res.status === 404, `got ${res.status}`);
      check(`${route} returns no session`, json(res)?.user === undefined, res.body.slice(0, 140));
    }

    // The Clerk exchange must reject a made-up token rather than trusting the
    // request body, which is what actually authorises the session.
    const forgedLogin = await request('POST', '/api/auth/login', {
      token: 'clerk.fake.token-for-testing',
      body: JSON.stringify({ email: 'attacker@example.com' }),
    });
    check(
      'a forged Clerk token cannot create a session',
      forgedLogin.status === 401 || forgedLogin.status === 403 || forgedLogin.status === 400,
      `got ${forgedLogin.status}`
    );
    check(
      'a forged Clerk token returns no user',
      json(forgedLogin)?.user === undefined,
      forgedLogin.body.slice(0, 140)
    );

    // /api/auth/me must stay closed to guests.
    const guestMe = await request('GET', '/api/auth/me');
    check('/api/auth/me is closed to guests', guestMe.status === 401, `got ${guestMe.status}`);

    // -----------------------------------------------------------------------
    // Payment routing must never trust the client for identity or destination
    // -----------------------------------------------------------------------
    console.log('\n[payment endpoints]');

    const config = await request('GET', '/api/payments/config');
    check('GET /api/payments/config -> 200', config.status === 200, `got ${config.status}`);
    check('payment config is JSON', isJson(config));
    check('payment config advertises a price', typeof json(config)?.priceInr === 'number', config.body.slice(0, 120));
    check(
      'payment config advertises the free-tier scan limit',
      typeof json(config)?.freeTierMonthlyLimit === 'number' && json(config).freeTierMonthlyLimit > 0,
      config.body.slice(0, 160)
    );
    check(
      'payment config exposes an owner profile',
      typeof json(config)?.owner?.handle === 'string' && json(config).owner.handle.startsWith('@'),
      config.body.slice(0, 160)
    );
    check(
      'payment config leaks no secret',
      !/secret|token|password|session/i.test(config.body),
      config.body.slice(0, 200)
    );

    // Guests cannot mint a payment reference.
    const guestPay = await request('POST', '/api/payments/request', { body: '{}' });
    check('POST /api/payments/request (guest) -> 401', guestPay.status === 401, `got ${guestPay.status}`);
    check('guest payment request is JSON', isJson(guestPay));
    check(
      'guest payment request is refused with a reason',
      typeof json(guestPay)?.error === 'string',
      guestPay.body.slice(0, 140)
    );
    check('guest payment request returns no telegram link', json(guestPay)?.telegramUrl === undefined);

    /*
     * The original bug: the paywall built `https://t.me/<handle>?text=<email>/<uid>`
     * in the browser, so any user could open devtools and address a message to
     * an arbitrary account claiming to be somebody else. These assertions pin the
     * fix: the handle lives only in server config, and identity is never read
     * from the request body.
     */
    check(
      'no Telegram handle is hard-coded in the served bundle',
      !/TheCreatorOfAkatsuki/.test(index.body),
      'the default handle leaked into index.html'
    );

    const spoof = await request('POST', '/api/payments/request', {
      body: JSON.stringify({
        email: 'victim@corp.com',
        userId: 'user_victim',
        handle: 'attacker',
        telegramUrl: 'https://t.me/attacker?text=stolen',
      }),
    });
    check('a spoofed identity is still refused', spoof.status === 401, `got ${spoof.status}`);
    check('a spoofed payload yields no reference', json(spoof)?.reference === undefined);
    check('a spoofed payload yields no attacker link', !/attacker/.test(spoof.body), spoof.body.slice(0, 160));

    const vault = await request('GET', '/uploads/anything.enc');
    check('GET /uploads/<file> is 404, not the SPA shell', vault.status === 404, `got ${vault.status}`);
    check('no ciphertext is returned from /uploads', !vault.body.includes('<div id="root"'), vault.body.slice(0, 80));
    check('the 404 explains itself', typeof json(vault)?.error === 'string', vault.body.slice(0, 120));
  } finally {
    await stop();
  }

  if (failures.length) {
    console.error(`\n${failures.length} of ${passed + failures.length} live-server checks failed.`);
    if (logs.length) console.error(`\n--- server log ---\n${logs.join('')}`);
    process.exit(1);
  }
  console.log(`\nAll ${passed} live-server checks passed.`);
  process.exit(0);
}

main().catch(async (err) => {
  console.error(`\n${err.message}`);
  if (logs?.length) console.error(`\n--- server log ---\n${logs.join('')}`);
  process.exit(1);
});
