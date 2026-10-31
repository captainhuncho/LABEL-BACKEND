// No clickjacking (owner rule): every response Vercel serves must send both
// X-Frame-Options: DENY and a CSP with frame-ancestors 'none', on every path
// (pages, the artist page, 404s, static files). Checks vercel.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const rules = config.headers || [];
const valueOf = (rule, name) => (rule.headers.find(h => h.key.toLowerCase() === name.toLowerCase()) || {}).value;

test('a catch-all header rule sends both framing headers', () => {
  const all = rules.find(r => r.source === '/(.*)' && !r.has && !r.missing);
  assert.ok(all, 'vercel.json needs a header rule for "/(.*)" with no conditions');
  assert.equal(valueOf(all, 'X-Frame-Options'), 'DENY');
  assert.match(valueOf(all, 'Content-Security-Policy') || '', /(^|;)\s*frame-ancestors 'none'\s*(;|$)/);
});

test('no other rule weakens either framing header', () => {
  for (const r of rules) {
    const xfo = valueOf(r, 'X-Frame-Options');
    if (xfo !== undefined) assert.equal(xfo, 'DENY', `${r.source}: X-Frame-Options`);
    const csp = valueOf(r, 'Content-Security-Policy');
    if (csp !== undefined) assert.match(csp, /frame-ancestors 'none'/, `${r.source}: CSP without frame-ancestors 'none'`);
  }
});

test('redirects stay on this site', () => {
  // Vercel sends no custom headers on a redirect; that's safe only while each
  // one points at a page of this app, which carries both headers.
  for (const r of config.redirects || []) assert.match(r.destination, /^\/(?!\/)/, `${r.source} redirects off-site`);
});

// Hide the stack (owner rule): nothing names the framework or its version.
test('no header rule adds X-Powered-By or Server', () => {
  for (const r of rules) for (const h of r.headers) assert.doesNotMatch(h.key, /^(x-powered-by|server)$/i, r.source);
});

test('production builds ship no source maps', () => {
  assert.match(readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8'), /sourcemap:\s*false/);
});

test('live response hides the stack (CHECK_URL=https://ops.imssrecords.com)', { skip: !process.env.CHECK_URL }, async () => {
  const res = await fetch(process.env.CHECK_URL);
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.doesNotMatch(res.headers.get('server') || '', /\d/, 'Server header carries a version');
});
