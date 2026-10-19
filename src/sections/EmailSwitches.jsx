// Admin: every email the platform sends, each with an On/Off switch
// (labelSettings.emailSwitches). Off stops the email; the bell notification stays.
import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { EMAIL_SWITCHES } from '../constants.js';
import { C } from '../theme.js';
import { logActivity } from '../audit.js';
import { supabase } from '../storage.js';

export function EmailSwitches({ labelSettings = {}, updateLabelSettings, startOpen = false }) {
  const [open, setOpen] = useState(startOpen);
  const sw = labelSettings.emailSwitches || {};
  const isOn = key => sw[key] !== false;
  const offCount = EMAIL_SWITCHES.filter(e => !isOn(e.key)).length;
  function toggle(e) {
    const next = { ...sw, [e.key]: !isOn(e.key) };
    if (next[e.key]) delete next[e.key]; // on is the default; only "off" is stored
    updateLabelSettings({ ...labelSettings, emailSwitches: next });
    logActivity((isOn(e.key) ? 'switched off' : 'switched on') + ' an email', e.label);
  }
  const groups = [...new Set(EMAIL_SWITCHES.map(e => e.group))];
  // Emails that still hadn't gone after 5 attempts (private.email_deliveries).
  const [failures, setFailures] = useState([]);
  useEffect(() => {
    if (!supabase || !startOpen) return;
    supabase.rpc('email_failures').then(({ data }) => setFailures(data || []), () => {});
  }, [startOpen]);
  return (
    <section aria-labelledby="email-sw-h" className="rounded border mb-6" style={{ background: C.panel, borderColor: C.border }}>
      {!startOpen && <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex items-center justify-between gap-3 w-full text-left" style={{ padding: '14px 16px' }}>
        <span className="flex items-center gap-2"><Mail size={16} aria-hidden="true" style={{ color: C.textDim }} /><span id="email-sw-h" style={{ fontWeight: 600 }}>Email notifications</span></span>
        <span className="text-sm" style={{ color: offCount ? C.amber : C.textDim }}>{offCount ? offCount + ' switched off' : 'All on'} · {open ? 'Hide' : 'Show'}</span>
      </button>}
      {open && (
        <div style={{ padding: startOpen ? '14px 16px' : '0 16px 14px' }}>
          {startOpen ? <p className="text-sm mb-3" style={{ color: offCount ? C.amber : C.textDim }}>{offCount ? offCount + ' switched off.' : 'All emails are on.'} Sign-in codes are always sent.</p> : <p className="text-sm mb-3" style={{ color: C.textDim }}>Every email the platform sends. Switching one off stops that email for everyone; the bell notification in the app still appears. Sign-in codes are always sent.</p>}
          {failures.length > 0 && (
            <div role="status" className="rounded mb-3 text-sm" style={{ border: '1px solid ' + C.border, padding: '10px 12px', color: C.amber }}>
              {failures.length} email batch{failures.length === 1 ? '' : 'es'} could not be sent after 5 tries. Latest: {new Date(failures[0].created_at).toLocaleString()}{failures[0].last_error ? ' (' + String(failures[0].last_error).slice(0, 160) + ')' : ''}.
            </div>
          )}
          {groups.map(g => (
            <div key={g} className="mb-3">
              <div className="text-xs mb-1" style={{ color: C.textFaint, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{g}</div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: '1px solid ' + C.border }}>
                {EMAIL_SWITCHES.filter(e => e.group === g).map(e => (
                  <li key={e.key} className="flex items-center justify-between gap-3" style={{ padding: '10px 0', borderBottom: '1px solid ' + C.border }}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 15 }}>{e.label}</span>
                      <span className="text-xs" style={{ color: C.textDim }}>To: {e.who}</span>
                    </span>
                    <button type="button" role="switch" aria-checked={isOn(e.key)} aria-label={e.label} onClick={() => toggle(e)}
                      style={{ flex: '0 0 auto', width: 51, height: 31, borderRadius: 999, background: isOn(e.key) ? 'var(--teal)' : 'var(--hairline-strong)', position: 'relative', transition: 'background .2s' }}>
                      <span aria-hidden="true" style={{ position: 'absolute', top: 2, left: isOn(e.key) ? 22 : 2, width: 27, height: 27, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .2s' }} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
