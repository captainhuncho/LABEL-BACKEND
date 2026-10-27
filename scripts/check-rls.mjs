/**
 * Build check: every table the API can reach must have row-level security on
 * and at least one policy, and the private schema must stay closed to the API.
 *
 * Reads the SQL in supabase/migrations (in file order) instead of running it,
 * because the migrations need Supabase's own schemas (auth, storage, pg_cron,
 * pg_net). Tables in `public` (or unqualified) count as API-reachable; tables
 * in `private` are allowed without RLS only while the last grant/revoke on
 * schema private leaves anon, authenticated and public without it. Fails (exit 1) and names each problem.
 * Run: node scripts/check-rls.mjs  (also runs before `npm run build`)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));
const IDENT = '(?:"?([a-z_][a-z0-9_]*)"?\\.)?"?([a-z_][a-z0-9_]*)"?';

const stripComments = (sql) => sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const qualify = (schema, name) => `${schema || 'public'}.${name}`;

function scan(sql, state) {
  const lower = stripComments(sql).toLowerCase();
  for (const m of lower.matchAll(new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?${IDENT}`, 'g'))) {
    state.tables.add(qualify(m[1], m[2]));
  }
  for (const m of lower.matchAll(new RegExp(`alter\\s+table\\s+(?:only\\s+)?${IDENT}\\s+(enable|disable)\\s+row\\s+level\\s+security`, 'g'))) {
    const t = qualify(m[1], m[2]);
    if (m[3] === 'enable') state.rls.add(t);
    else state.rls.delete(t);
  }
  for (const m of lower.matchAll(new RegExp(`create\\s+policy\\s+(?:"[^"]+"|\\S+)\\s+on\\s+${IDENT}`, 'g'))) {
    state.policies.add(qualify(m[1], m[2]));
  }
  // Which API roles can use schema private, statement by statement.
  for (const m of lower.matchAll(/\b(grant|revoke)\s+(all|usage)(?:\s+privileges)?\s+on\s+schema\s+private\s+(?:to|from)\s+([^;]*)/g)) {
    for (const role of API_ROLES) {
      if (!new RegExp(`\\b${role}\\b`).test(m[3])) continue;
      if (m[1] === 'grant') state.privateOpen.add(role);
      else state.privateOpen.delete(role);
    }
  }
}
const API_ROLES = ['anon', 'authenticated', 'public'];

function main() {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  const state = { tables: new Set(), rls: new Set(), policies: new Set(), privateOpen: new Set(API_ROLES) };
  for (const f of files) scan(readFileSync(join(DIR, f), 'utf8'), state);

  const problems = [];
  for (const t of [...state.tables].sort()) {
    if (t.startsWith('private.')) continue;
    if (!state.rls.has(t)) problems.push(`${t}: row-level security is off`);
    else if (!state.policies.has(t)) problems.push(`${t}: RLS on but no policy (add one, even a narrow one)`);
  }
  const privateTables = [...state.tables].filter((t) => t.startsWith('private.'));
  if (privateTables.length && state.privateOpen.size) {
    problems.push(`schema private is still usable by ${[...state.privateOpen].join(', ')} (${privateTables.length} tables exposed)`);
  }

  if (problems.length) {
    console.error(`Row-level security check failed (${problems.length}):`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error('Each API-reachable table needs `alter table <name> enable row level security;` and a policy.');
    process.exit(1);
  }
  const api = state.tables.size - privateTables.length;
  console.log(`Row-level security check: ${api} API tables have RLS and policies; ${privateTables.length} private tables closed to the API (${files.length} migrations).`);
}

main();
