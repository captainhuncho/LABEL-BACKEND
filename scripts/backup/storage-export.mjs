// Copies every object in the private Storage buckets (documents, statements) to
// a local folder, with a manifest of sizes and SHA-256 checksums, for the
// off-site backup (.github/workflows/offsite-backup.yml). Read-only on Supabase.
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/backup/storage-export.mjs out/storage
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const [outDir = 'out/storage'] = process.argv.slice(2);
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required'); process.exit(1); }
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function listAll(bucket, prefix = '') {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const e of data) {
      const path = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.id === null) out.push(...await listAll(bucket, path)); // a folder
      else out.push(path);
    }
    if (data.length < 1000) return out;
  }
}

const manifest = [];
for (const bucket of ['documents', 'statements']) {
  for (const path of await listAll(bucket)) {
    const { data, error } = await db.storage.from(bucket).download(path);
    if (error) throw new Error(`${bucket}/${path}: ${error.message}`);
    const bytes = Buffer.from(await data.arrayBuffer());
    const file = join(outDir, bucket, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, bytes);
    manifest.push({ bucket, path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
}
await writeFile(join(outDir, 'manifest.json'), JSON.stringify({ takenAt: new Date().toISOString(), objects: manifest }, null, 1));
console.log(`storage: ${manifest.length} objects, ${manifest.reduce((t, m) => t + m.bytes, 0)} bytes`);
