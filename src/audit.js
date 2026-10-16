// Activity audit and in-app notifications.
// With Supabase, the database decides who the actor is from the signed-in
// session (log_activity); without it (local copy), entries go to localStorage.
import { supabase } from './storage.js';

const LOCAL_KEY = 'imss:audit';

// Fire-and-forget: logging must never block or break what the person is doing.
export function logActivity(action, detail = '', artistId = null, meta = {}) {
  if (supabase) {
    supabase.rpc('log_activity', { action, detail: String(detail || '').slice(0, 500), artist_id: artistId, meta }).then(() => {}, () => {});
    return;
  }
  try {
    const list = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    list.unshift({ id: Date.now() + Math.random(), at: new Date().toISOString(), actor_name: window.__imssActor || 'Local user', actor_kind: window.__imssActorKind || 'team', action, detail, artist_id: artistId });
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 1000)));
  } catch (e) { /* storage full or blocked: skip */ }
}

// Once per browser session.
export function logSignIn(kind, name) {
  window.__imssActor = name; window.__imssActorKind = kind;
  try { if (sessionStorage.getItem('imss:signin-logged')) return; sessionStorage.setItem('imss:signin-logged', '1'); } catch (e) { /* ignore */ }
  logActivity('signed in', kind === 'artist' ? 'Artist portal' : 'Team dashboard');
}

export async function readAudit({ limit = 500 } = {}) {
  if (!supabase) { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]').slice(0, limit); } catch (e) { return []; } }
  const { data, error } = await supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

export async function readNotifications() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('notifications').select('*').order('at', { ascending: false }).limit(50);
  if (error) throw error;
  return data || [];
}

export async function markNotificationsRead(ids = null) {
  if (!supabase) return;
  await supabase.rpc('mark_notifications_read', { ids });
}
