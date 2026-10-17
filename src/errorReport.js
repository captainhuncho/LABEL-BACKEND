import { supabase } from './storage.js';

// Send uncaught errors to the database (Admin sees them on Backup & Restore).
// Same message at most once per page load.
export function installErrorReport() {
  if (!supabase) return;
  const seen = new Set();
  const report = (message, stack) => {
    const key = String(message).slice(0, 200);
    if (!key || seen.has(key) || seen.size > 20) return;
    seen.add(key);
    supabase.rpc('log_client_error', { message: key, stack: String(stack || '').slice(0, 2000), url: window.location.href.split('?')[0] }).then(() => {}, () => {});
  };
  window.addEventListener('error', e => report(e.message, e.error && e.error.stack));
  window.addEventListener('unhandledrejection', e => report(e.reason && e.reason.message || e.reason, e.reason && e.reason.stack));
}
