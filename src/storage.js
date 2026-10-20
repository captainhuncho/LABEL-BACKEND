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
  // Production without Supabase settings fails closed (see main.jsx).
  if (!supabase && import.meta.env.PROD && import.meta.env.VITE_DEMO !== '1') return;
  window.storage = supabase ? supabaseStorage : localStorageStorage;
}

// Every save says which version of the section it was built on. If someone
// else saved since (another tab, a person, a direct database edit), the save
// is refused with a 'conflict' error instead of overwriting their rows.
const versions = new Map();
function conflict(key) { const e = new Error('changed since loaded: ' + key); e.code = 'conflict'; e.key = key; return e; }
export function isConflict(e) { return !!e && e.code === 'conflict'; }

// The import and publish flows change two sections as one logical action.
// Supabase commits both in a database transaction; local preview rolls back if
// either localStorage write fails.
export async function setSectionPair(firstKey, firstValue, secondKey, secondValue) {
  const values = [[firstKey, firstValue], [secondKey, secondValue]];
  if (!supabase) {
    const before = values.map(([key]) => [key, window.localStorage.getItem(PREFIX + key), window.localStorage.getItem(PREFIX + 'v:' + key), versions.get(key)]);
    for (const [key, , version] of before) {
      const current = version || (window.localStorage.getItem(PREFIX + key) === null ? null : '0');
      if (current !== null && versions.has(key) && versions.get(key) !== current) throw conflict(key);
    }
    try {
      for (const [key, value] of values) await localStorageStorage.set(key, JSON.stringify(value));
    } catch (e) {
      for (const [key, raw, version, loaded] of before) {
        if (raw === null) window.localStorage.removeItem(PREFIX + key); else window.localStorage.setItem(PREFIX + key, raw);
        if (version === null) window.localStorage.removeItem(PREFIX + 'v:' + key); else window.localStorage.setItem(PREFIX + 'v:' + key, version);
        if (loaded === undefined) versions.delete(key); else versions.set(key, loaded);
      }
      throw e;
    }
    return;
  }
  const first = realKey(firstKey), second = realKey(secondKey);
  if (!versions.has(first) || !versions.has(second)) throw new Error('Reload before saving these sections');
  const { data, error } = await supabase.rpc('save_app_data_pair', {
    first_key: first, first_value: firstValue, first_version: versions.get(first),
    second_key: second, second_value: secondValue, second_version: versions.get(second),
  });
  if (error) {
    if (error.code === '40001') throw conflict(error.message.includes(second) ? secondKey : firstKey);
    throw error;
  }
  versions.set(first, data[first]); versions.set(second, data[second]);
}

const localStorageStorage = {
  async get(key) {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) throw new Error('not found: ' + key);
    versions.set(key, window.localStorage.getItem(PREFIX + 'v:' + key) || '0');
    return { value: raw };
  },
  async set(key, value) {
    const current = window.localStorage.getItem(PREFIX + 'v:' + key) || (window.localStorage.getItem(PREFIX + key) === null ? null : '0');
    if (current !== null && versions.has(key) && versions.get(key) !== current) throw conflict(key);
    const next = String(Number(current || 0) + 1);
    window.localStorage.setItem(PREFIX + key, value);
    window.localStorage.setItem(PREFIX + 'v:' + key, next);
    versions.set(key, next);
    return true;
  },
};

// Team members without deal access can't read `roster`; they get `rosterPublic`
// (deal fields removed) and save to it. The database merges it back.
const PUBLIC_COPY = { roster: 'rosterPublic' };
const aliases = new Map();
const realKey = key => aliases.get(key) || key;
// Product Managers read artist sections through pm_read() (only their artists'
// items) and save through pm_save(), which merges their items back.
const pmKeys = new Set();
const selfOnly = new Set();
async function readRow(key) {
  const { data, error } = await supabase.from('app_data').select('value, updated_at').eq('key', key).maybeSingle();
  if (error) throw error;
  return data;
}
async function readPm(key) {
  const { data, error } = await supabase.rpc('pm_read', { k: key });
  if (error && error.code === 'PGRST202') return null; // function not deployed yet
  if (error) throw error;
  return data && data[0] ? data[0] : null;
}
const supabaseStorage = {
  async get(name) {
    const candidates = aliases.has(name) ? [aliases.get(name)] : [name, PUBLIC_COPY[name]].filter(Boolean);
    let key = null, data = null;
    for (const k of candidates) {
      data = pmKeys.has(k) ? await readPm(k) : await readRow(k);
      if (!data && !pmKeys.has(k)) { data = await readPm(k); if (data) pmKeys.add(k); }
      if (data) { key = k; break; }
    }
    // Only Admin and Legal read the team list; everyone else gets their own record.
    if (!data && name === 'staff') {
      const { data: self, error } = await supabase.rpc('staff_self');
      if (error && error.code !== 'PGRST202') throw error;
      if (self && self[0]) { data = self[0]; key = 'staff'; selfOnly.add('staff'); }
    }
    if (!data) throw new Error('not found: ' + name);
    if (key !== name) aliases.set(name, key);
    versions.set(key, data.updated_at);
    // Sections are stored as JSON; dataVersion is a bare string.
    return { value: typeof data.value === 'string' ? data.value : JSON.stringify(data.value) };
  },
  async set(name, value) {
    const key = realKey(name);
    let parsed;
    try { parsed = JSON.parse(value); } catch { parsed = value; }
    const updated_at = new Date().toISOString();
    if (selfOnly.has(key)) {
      const e = new Error('Only Admin and Legal change the team list'); e.code = '42501'; throw e;
    }
    if (pmKeys.has(key)) {
      const { data, error } = await supabase.rpc('pm_save', { k: key, v: parsed, expected: versions.get(key) });
      if (error) throw error;
      if (!data) throw conflict(name);
      versions.set(key, data);
      return true;
    }
    if (!versions.has(key)) {
      // Never loaded (a new section): create it, but never replace one that exists.
      const { data, error } = await supabase.from('app_data').insert({ key, value: parsed, updated_at }).select('updated_at').maybeSingle();
      if (error) { if (error.code === '23505') throw conflict(name); throw error; }
      versions.set(key, data ? data.updated_at : updated_at);
      return true;
    }
    // Only overwrite the version this tab loaded; zero rows back means it moved on.
    const { data, error } = await supabase.from('app_data').update({ value: parsed, updated_at })
      .eq('key', key).eq('updated_at', versions.get(key)).select('updated_at');
    if (error) throw error;
    if (!data || data.length === 0) throw conflict(name);
    versions.set(key, data[0].updated_at);
    return true;
  },
};

// Calls onChange(key) when another tab or person changes a section (Supabase
// realtime; in local mode, the browser's storage event between tabs). Our own
// saves are skipped. Returns an unsubscribe function.
export function subscribeToChanges(onChange) {
  if (!supabase) {
    const handler = e => { if (e.key && e.key.startsWith(PREFIX + 'v:')) { const key = e.key.slice(PREFIX.length + 2); if (versions.get(key) !== e.newValue) onChange(key); } };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }
  const channel = supabase.channel('app_data_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_data' }, payload => {
      const row = payload.new || {};
      const name = [...aliases].find(([, k]) => k === row.key)?.[0] || row.key;
      if (row.key && versions.get(row.key) !== row.updated_at) onChange(name);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

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

export async function removeStatementFile(path) {
  if (!supabase || !path) return;
  const { error } = await supabase.storage.from('statements').remove([path]);
  if (error) throw error;
}

// After an import whose save outcome is unknown (the response was lost): read
// the saved statement files fresh and remove only uploads nothing points to.
// If that read fails, nothing is removed.
export async function removeUnreferenced(paths) {
  if (!supabase || !paths.length) return;
  const { data, error } = await supabase.from('app_data').select('value').eq('key', 'statementFiles').maybeSingle();
  if (error || !data || !Array.isArray(data.value)) return;
  const used = new Set(data.value.map(f => f && f.path).filter(Boolean));
  const orphans = paths.filter(p => !used.has(p));
  if (orphans.length) await supabase.storage.from('statements').remove(orphans);
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
