import { History, Search } from 'lucide-react';
import { useState } from 'react';
import { C, HEADING_FONT } from '../theme.js';
import { EmptyState, ExportBar, SectionHeader, Td, Th } from '../ui.jsx';

export function ActivityLogSection({ activityLog }) {
  const [search, setSearch] = useState('');
  const filtered = activityLog.filter(e => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (e.actor || '').toLowerCase().includes(q) || (e.section || '').toLowerCase().includes(q);
  });

  return (
    <div>
      <SectionHeader title="Activity Log" description="A running record of who changed what across the dashboard." />
      <div className="flex items-center gap-2 mb-6 rounded border px-3 py-2" style={{ borderColor: C.border, background: C.panel, maxWidth: 320 }}>
        <Search size={14} color={C.textFaint} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by person or section" className="w-full text-sm bg-transparent" style={{ color: C.text, fontFamily: HEADING_FONT, border: 'none' }} />
      </div>
      <ExportBar filename="imss-activity-log" headers={['When', 'Who', 'What']} rows={filtered.map(e => [new Date(e.timestamp).toLocaleString(), e.actor, e.actor + ' ' + e.action + ' ' + e.section])} />
      {filtered.length === 0 ? (
        <EmptyState icon={History} title="Nothing logged yet" description="Changes made across the dashboard will show up here as they happen." />
      ) : (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <table className="w-full" style={{ minWidth: 480 }}>
            <thead><tr><Th>When</Th><Th>Who</Th><Th>What</Th></tr></thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id}>
                  <Td mono>{new Date(e.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Td>
                  <Td>{e.actor}</Td>
                  <Td>{e.actor} {e.action} {e.section}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
