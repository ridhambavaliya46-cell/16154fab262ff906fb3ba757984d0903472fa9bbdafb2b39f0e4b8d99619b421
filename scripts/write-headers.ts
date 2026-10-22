/**
 * Writes Netlify's `_headers` file into the build output.
 *
 * WHY THIS EXISTS
 * ---------------
 * The security headers in lib/csp.ts were only ever attached by the Express app,
 * which means they reached API responses and the dev server's index.html — but
 * not the deployed site. On Netlify the document and every hashed asset are
 * served straight from the CDN, so the page loaded with NO Content-Security-Policy
 * at all: the policy protecting the API was never applied to the app itself.
 *
 * Netlify reads `_headers` from the publish directory, which is the only place
 * these headers can be attached to static responses. Generating the file at
 * build time rather than hand-writing it keeps one source of truth: the policy
 * comes from the same `buildContentSecurityPolicy()` the server uses, including
 * the Clerk origin derived from VITE_CLERK_PUBLISHABLE_KEY. A hand-written
 * policy would drift the moment a Clerk instance changed.
 *
 * Scripted so a missing value fails the build instead of silently shipping an
 * unlocked policy.
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildContentSecurityPolicy, SECURITY_HEADERS, HSTS_HEADER } from '../lib/csp.js';

const DIST = resolve(process.cwd(), 'dist');

/** Only the headers that make sense on a static CDN response. */
function buildHeaders(): string {
  const csp = buildContentSecurityPolicy({
    // Never relax script-src for a production build.
    isDev: false,
    clerkPublishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY,
  });

  const lines: string[] = [
    '/*',
    `  Content-Security-Policy: ${csp}`,
    `  X-Content-Type-Options: ${SECURITY_HEADERS['X-Content-Type-Options']}`,
    `  X-Frame-Options: ${SECURITY_HEADERS['X-Frame-Options']}`,
    `  Referrer-Policy: ${SECURITY_HEADERS['Referrer-Policy']}`,
    `  Permissions-Policy: ${SECURITY_HEADERS['Permissions-Policy']}`,
    `  Strict-Transport-Security: ${HSTS_HEADER}`,
    '',
    '# Hashed build assets are immutable and never re-read, so they can be',
    '# cached hard. index.html must not be, or a deploy would not reach users.',
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/*.html',
    '  Cache-Control: public, max-age=0, must-revalidate',
    '',
  ];

  return lines.join('\n');
}

function main(): void {
  const key = process.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error(
      'VITE_CLERK_PUBLISHABLE_KEY is not set, so the Content-Security-Policy would omit the Clerk origin and block every sign-in. Refusing to write _headers.'
    );
  }

  mkdirSync(DIST, { recursive: true });
  const file = resolve(DIST, '_headers');
  writeFileSync(file, buildHeaders(), 'utf8');

  console.log(`Wrote ${file}`);
  console.log('  Clerk origin included:', key.slice(0, 12) + '…');
  console.log('  script-src:', buildContentSecurityPolicy({ isDev: false, clerkPublishableKey: key })
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith('script-src')));
}

main();
