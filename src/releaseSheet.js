// The release sheet a label rep downloads: the same fields as the artist's
// transfer/publishing template (ArtistPortal), without the rights line.
import { logActivity } from './audit.js';

export const RELEASE_SHEET_HEADERS = ['Song Title', 'Primary Artist(s)', 'Featured Artist(s)', 'Release Type', 'Release Date', 'ISRC', 'UPC', 'Label', '℗ Line', 'Genre', 'Explicit/Clean', 'Duration', 'Written By (Songwriters)', 'Produced By', 'Splits', 'Recording Engineer', 'Mixing Engineer', 'Mastering Engineer', 'Dolby Atmos', 'Dolby Engineer', 'Lyrics', 'Music Video', 'Status', 'Primary Market', 'Secondary Market'];

export function releaseSheetRow(r, artist = {}) {
  const cr = r.credits || {};
  const collabs = r.collaborators || [];
  const label = r.label || 'IMSS Records';
  return [
    r.title, [artist.name, ...(r.primaryArtists || [])].filter(Boolean).join(' & '),
    collabs.filter(c => c.role === 'Feature').map(c => c.name).join(', '),
    r.type || '', r.releaseDate || '', r.isrc || '', r.upc || '', label,
    r.releaseDate ? '℗ ' + r.releaseDate.slice(0, 4) + ' ' + label : '',
    r.genre || artist.genre || '', r.explicit && r.explicit !== 'Not Set' ? r.explicit : '', r.duration || '',
    cr.writtenBy || '', cr.producedBy || collabs.filter(c => c.role === 'Producer').map(c => c.name).join(', '),
    collabs.map(c => c.name + ' (' + c.role + ', ' + c.splitPercent + '%)').join('; '),
    cr.recordingEngineer || '', cr.mixingEngineer || '', cr.masteringEngineer || '',
    r.dolbyAtmos ? 'Yes' : 'No', cr.dolbyEngineer || '', r.lyrics || '', r.hasVideo ? 'Yes' : 'No',
    r.status || '', r.primaryMarket || '', r.secondaryMarket || '',
  ];
}

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// A Word document (opens in Word and Google Docs): one section per record,
// each a two-column table of field and value.
// The logo is linked from the live site (not this page's address), so it shows
// wherever the file is opened, Word or Google Docs, as long as it's online.
export function exportRecordsToWord(filename, title, headers, rows, heading = r => r[0]) {
  logActivity('exported Word', filename + ' (' + rows.length + ')');
  const body = rows.map(r => `<h2 style="font-family:Arial;font-size:15pt;margin:18pt 0 6pt">${esc(heading(r))}</h2>
<table style="border-collapse:collapse;width:100%;font-family:Arial;font-size:10.5pt">${headers.map((h, i) => r[i] === '' || r[i] == null ? '' : `<tr><td style="border:1px solid #ccc;padding:4pt 6pt;width:34%;color:#555">${esc(h)}</td><td style="border:1px solid #ccc;padding:4pt 6pt">${esc(r[i]).replace(/\n/g, '<br>')}</td></tr>`).join('')}</table>`).join('');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(title)}</title></head><body><img src="https://ops.imssrecords.com/email-logo-dark.png" width="88" height="40" alt="IMSS Records" style="display:block;margin:0 0 12pt"><h1 style="font-family:Arial;font-size:20pt">${esc(title)}</h1>${body}<p style="font-family:Arial;font-size:9pt;color:#888;margin-top:24pt">IMSS Records · exported ${new Date().toISOString().slice(0, 10)}</p></body></html>`;
  const url = URL.createObjectURL(new Blob(['﻿', html], { type: 'application/msword' }));
  const a = document.createElement('a'); a.href = url; a.download = filename + '.doc';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
