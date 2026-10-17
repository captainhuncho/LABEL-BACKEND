import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { Btn } from './ui.jsx';
import { C } from './theme.js';
import { supabase } from './storage.js';

// Ends every session the person has; they sign in again with a new emailed code.
export default function SignOutEverywhere({ kind, id, name }) {
  const [state, setState] = useState('idle');
  if (!supabase) return null;
  async function go() {
    if (!window.confirm('Sign ' + name + ' out on every device? They can sign in again with a new emailed code.')) return;
    setState('working');
    const { data, error } = await supabase.rpc('sign_out_everywhere', { kind, target_id: id });
    setState(error ? 'error' : data > 0 ? 'done' : 'none');
  }
  const msg = { error: 'Could not sign them out. Try again.', done: name + ' is signed out everywhere.', none: name + ' had no active sessions.' }[state];
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <Btn variant="ghost" onClick={go} disabled={state === 'working'}><LogOut size={14} /> {state === 'working' ? 'Signing out…' : 'Sign out everywhere'}</Btn>
      {msg && <span className="text-xs" role="status" style={{ color: state === 'error' ? C.red : C.teal }}>{msg}</span>}
    </span>
  );
}
