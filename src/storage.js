// The dashboard persists through `window.storage`, an async key/value store.
// In the browser that's localStorage; swap this adapter for an API client when
// you move the data server-side — nothing else in the app needs to change.
const PREFIX = 'imss:';

export function installStorage() {
  if (window.storage) return;
  window.storage = {
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
}
