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
