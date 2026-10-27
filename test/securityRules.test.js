// The five security rules (owner, 27 Oct), as the smallest checks that prove
// each one on this codebase. Rule 2 (send only the fields each portal shows)
// lives in the database: supabase/tests/portal_fields.sql.
//   1. Filters are never built from input: no string-built PostgREST filters,
//      table/RPC names are fixed, values go as bound parameters.
//   3. Edge functions fetch only fixed hosts; ids from a request are encoded.
//   4. No XSS: no raw HTML from data, and profile links are https only.
//   5. CORS locked: no edge function answers Access-Control-Allow-Origin: *.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { safeLink } from '../src/seed.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const walk = dir => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const sources = dir => walk(join(ROOT, dir)).filter(p => /\.(js|jsx|ts|tsx)$/.test(p)).map(p => ({ file: relative(ROOT, p), text: readFileSync(p, 'utf8') }));
const CLIENT = sources('src');
const FUNCTIONS = sources('supabase/functions').filter(f => !/\.test\.|\.deno\./.test(f.file));
const hits = (files, re) => files.flatMap(({ file, text }) => [...text.matchAll(re)].map(m => file + ': ' + m[0].slice(0, 80)));

// ---------------------------------------------------------------- rule 1
test('rule 1: the client builds no PostgREST filter strings (.or/.ilike/.like/.textSearch, or .filter with a column)', () => {
  assert.deepEqual(hits(CLIENT, /\.(or|ilike|like|textSearch|not)\(\s*[^)]/g), []);
  // Array#filter takes a function; the query builder's .filter takes ('column', 'op', value).
  assert.deepEqual(hits(CLIENT, /\.filter\(\s*['"`]/g), []);
});

test('rule 1: table, bucket, order and RPC names are fixed strings, never from input', () => {
  // Array.from(...) is not the query builder.
  assert.deepEqual(hits(CLIENT, /(?<!Array)\.from\(\s*(?!['"])[^)]/g), []);
  assert.deepEqual(hits(CLIENT, /\.order\(\s*(?!['"])[^)]/g), []);
  assert.deepEqual(hits(CLIENT, /\.from\(\s*`|\.rpc\(\s*`|\.order\(\s*`/g), []);
  // One RPC name comes from a prop (MyActivity); every caller passes a literal.
  const named = hits(CLIENT, /\.rpc\(\s*(?!['"])[^)]*/g);
  assert.deepEqual(named, ['src/RepApp.jsx: .rpc(rpc']);
  assert.deepEqual(hits(CLIENT, /\brpc=\{/g), [], 'MyActivity rpc must be a literal, e.g. rpc="artist_my_activity"');
});

test('rule 1: edge functions use the query builder with fixed names too', () => {
  assert.deepEqual(hits(FUNCTIONS, /\.(or|ilike|like|textSearch|not)\(\s*[^)]/g), []);
  assert.deepEqual(hits(FUNCTIONS, /(?<!(Array|Uint8Array))\.(from|rpc|order)\(\s*(?!['"])[^)]/g), []);
});

test('rule 1: no database function runs SQL built at request time', () => {
  // One-off "do $$ … end $$;" blocks run once when a migration is applied
  // (they patch function definitions from fixed text); strip them. What is
  // left is function bodies and grants: any EXECUTE there must be a grant,
  // a trigger's "execute function", or format() with fixed identifiers.
  const sql = walk(join(ROOT, 'supabase/migrations')).filter(p => p.endsWith('.sql')).map(p => {
    const text = readFileSync(p, 'utf8').split('\n').reduce((acc, line) => {
      if (/^do\s+\$/i.test(line)) acc.skip = true;
      if (!acc.skip) acc.out.push(line);
      if (/^end\s+\$[a-z_]*\$\s*;/i.test(line)) acc.skip = false;
      return acc;
    }, { skip: false, out: [] }).out.join('\n').replace(/--[^\n]*/g, '');
    return { file: relative(ROOT, p), text };
  });
  assert.deepEqual(hits(sql, /\bexecute\s+(?!on\s+functions?\b|function\b|format\(\s*'[^']*%I)[^;\n]*/gi), []);
});

test('rule 1: injection-looking input is sent as a bound value, not as query syntax', async () => {
  const sent = [];
  const fetch = async (url, init = {}) => { sent.push({ url: String(url), body: init.body }); return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }); };
  const db = createClient('http://localhost:54321', 'test-anon-key', { global: { fetch }, auth: { persistSession: false, autoRefreshToken: false } });
  const evil = "' OR 1=1 --),or=(key.neq.x";
  await db.from('app_data').select('value').eq('key', evil);
  await db.rpc('artist_add', { section_key: evil, item: { title: evil } });
  const q = new URL(sent[0].url).searchParams;
  assert.deepEqual([...q.keys()].sort(), ['key', 'select']);
  assert.equal(q.get('key'), 'eq.' + evil); // one parameter: the whole string is the value
  assert.equal(q.get('or'), null);
  assert.deepEqual(JSON.parse(sent[1].body), { section_key: evil, item: { title: evil } });
});

// ---------------------------------------------------------------- rule 3
test('rule 3: edge functions fetch only api.songstats.com and api.resend.com', () => {
  const calls = hits(FUNCTIONS, /\bfetch\(\s*[^,)]+/g);
  assert.ok(calls.length >= 3, 'expected the songstats and resend calls: ' + calls.join(' | '));
  for (const c of calls) assert.match(c, /fetch\(\s*(`\$\{BASE\}|['`]https:\/\/api\.resend\.com\/)/, c);
  const songstats = FUNCTIONS.find(f => f.file.includes('songstats')).text;
  assert.match(songstats, /const BASE = 'https:\/\/api\.songstats\.com\/[^'$]*';/);
  // Every path given to songstats() is a fixed string.
  const paths = [...songstats.matchAll(/\bsongstats\(\s*([^,]+),/g)].map(m => m[1]).filter(p => p !== 'path: string');
  assert.ok(paths.length > 0);
  for (const p of paths) assert.match(p, /^'\/[a-z/]+'$/, p);
});

test('rule 3: an inbound email id is URL-encoded before it goes into the Resend path', () => {
  const notify = FUNCTIONS.find(f => f.file.includes('notify')).text;
  assert.match(notify, /api\.resend\.com\/emails\/receiving\/\$\{encodeURIComponent\(String\(emailId\)\)\}/);
  assert.doesNotMatch(notify, /receiving\/\$\{emailId\}/);
});

// ---------------------------------------------------------------- rule 4
test('rule 4: no raw HTML from data in the client', () => {
  assert.deepEqual(hits(CLIENT, /dangerouslySetInnerHTML|outerHTML\s*=|insertAdjacentHTML|document\.write\(/g), []);
  // The only innerHTML is the pull-to-refresh ring: one fixed string, nothing interpolated.
  const inner = CLIENT.flatMap(({ file, text }) => text.split('\n').filter(l => /\.innerHTML\s*=/.test(l)).map(l => ({ file, l })));
  assert.deepEqual(inner.map(x => x.file), ['src/pullToRefresh.js']);
  assert.match(inner[0].l, /\.innerHTML\s*=\s*'[^'$`+]*';\s*$/);
});

test('rule 4: safeLink keeps https links and refuses every other scheme', () => {
  assert.equal(safeLink('https://open.spotify.com/artist/1'), 'https://open.spotify.com/artist/1');
  assert.equal(safeLink('  HTTPS://example.com  '), 'HTTPS://example.com');
  for (const bad of ['javascript:alert(1)', ' JavaScript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,<script>alert(1)</script>',
    'http://example.com', '//evil.example', 'vbscript:msgbox(1)', 'ftp://example.com', '', null, undefined, 'https:/x', 'example.com'])
    assert.equal(safeLink(bad), '', String(bad));
});

// ---------------------------------------------------------------- rule 5
test('rule 5: no edge function sends Access-Control-Allow-Origin: *', () => {
  assert.deepEqual(hits(FUNCTIONS, /Access-Control-Allow-Origin['"]?\s*[:,]\s*['"`]\*/gi), []);
  assert.deepEqual(hits(FUNCTIONS, /corsHeaders|_shared\/cors/g), []);
  const vercel = readFileSync(join(ROOT, 'vercel.json'), 'utf8');
  assert.doesNotMatch(vercel, /Access-Control-Allow-Origin/i);
});
