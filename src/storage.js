// The dashboard persists through `window.storage`, an async key/value store.
// With VITE_SUPABASE_URL set it's the shared Supabase `app_data` table (one
// row per section); without it, this browser's localStorage.
import { createClient } from '@supabase/supabase-js';

const PREFIX = 'imss:';
const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = url && publishableKey ? createClient(url, publishableKey) : null;

export function installStorage() {
  if (window.storage) return;
  window.storage = supabase ? supabaseStorage : localStorageStorage;
}

const localStorageStorage = {
  async get(key) {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) throw new Error('not found: ' + key);
    return { value: raw };
  },
  async set(key, value) {
    window.localStorage.setItem(PREFIX + key, value);
    return true;
  },
};

const supabaseStorage = {
  async get(key) {
    const { data, error } = await supabase.from('app_data').select('value').eq('key', key).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('not found: ' + key);
    // Sections are stored as JSON; dataVersion is a bare string.
    return { value: typeof data.value === 'string' ? data.value : JSON.stringify(data.value) };
  },
  async set(key, value) {
    let parsed;
    try { parsed = JSON.parse(value); } catch { parsed = value; }
    const { error } = await supabase.from('app_data').upsert({ key, value: parsed, updated_at: new Date().toISOString() });
    if (error) throw error;
    return true;
  },
};

// Original statement files. With Supabase they live in the private
// `statements` bucket under <artistId>/; locally they're kept as data URLs.
export async function saveStatementFile(artistId, fileId, file) {
  if (!supabase) {
    const dataUrl = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); });
    return { dataUrl };
  }
  const path = artistId + '/' + fileId + '.csv';
  const { error } = await supabase.storage.from('statements').upload(path, file, { contentType: 'text/csv', upsert: true });
  if (error) throw error;
  return { path };
}

export async function statementFileUrl(record) {
  if (record.dataUrl) return record.dataUrl;
  const { data, error } = await supabase.storage.from('statements').createSignedUrl(record.path, 120, { download: record.name || true });
  if (error) throw error;
  return data.signedUrl;
}

// Documents (invoice attachments, split sheets, signed agreements, PDF
// statements). With Supabase they live in the private `documents` bucket under
// <artistId>/ and the record keeps "doc:<path>"; locally (and for older
// records) the value is a data URL.
export const DOC_MAX_BYTES = supabase ? 10 * 1024 * 1024 : 2 * 1024 * 1024;
export async function uploadDocument(artistId, file) {
  if (!supabase) return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); });
  const safe = String(file.name || 'file').replace(/[^A-Za-z0-9._-]+/g, '-').slice(-80);
  const path = (artistId || 'label') + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + '-' + safe;
  const { error } = await supabase.storage.from('documents').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (error) throw error;
  return 'doc:' + path;
}
export async function documentUrl(value, name) {
  if (!String(value || '').startsWith('doc:')) return value;
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(value.slice(4), 120, { download: name || true });
  if (error) throw error;
  return data.signedUrl;
}
