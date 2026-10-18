// Made-up label for the demo site (built with VITE_DEMO=1): fictional artists,
// songs and money. Nothing here is real; the real data is never in a demo build.
import { ONBOARDING_TASKS_TEMPLATE, defaultPermissionsForRole } from './constants.js';
import { publishSnapshot, slug } from './finance.js';

// Same numbers on every build (a small seeded generator, not Math.random).
let s = 20261017;
const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);

const ARTISTS = [
  ['Nova Reign', 70, 'Afrobeats', 'Funded', 12000], ['Kofi Lume', 75, 'Highlife', 'Non-Funded', 0],
  ['Ama Vesper', 60, 'R&B', 'Funded', 8000], ['The Sunday Club', 70, 'Alté', 'Non-Funded', 0],
  ['Juno Blaze', 65, 'Amapiano', 'Non-Funded', 0], ['Lyric Atlas', 70, 'Hip-hop', 'Funded', 5000],
];
const TITLES = ['Golden Hour', 'Lagos Rain', 'Slow Motion', 'Midnight Call', 'Coastline', 'Paper Planes', 'Overflow', 'Velvet', 'Signal', 'Home Again', 'Wildfire', 'Daylight', 'Echoes', 'Moonlit', 'Run It Back', 'Sugarcane', 'Afterglow', 'Northbound'];
const MONTHS = Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.UTC(2025, 9 + i, 1)); return d.toISOString().slice(0, 7); });

export const DEMO_STAFF = [
  ['Demo Admin', 'Admin'], ['Sam Okafor', 'Product Manager'], ['Rita Mensah', 'Finance'], ['Leo Hart', 'A&R'], ['Kojo Asante', 'Label Rep'],
].map(([name, role], i) => ({ id: 'demo-st' + i, name, role, email: slug(name) + '@example.com', phone: '', startDate: '2024-01-15', status: 'Active', bio: '', photoUrl: '', permissions: defaultPermissionsForRole(role), onboarding: ONBOARDING_TASKS_TEMPLATE.map((label, j) => ({ id: 'ob' + j + '-demo-st' + i, label, done: true })) }));

export const DEMO_ROSTER = ARTISTS.map(([name, pct, genre, tier, budget], i) => ({
  id: slug(name), name, genre, subGenre: '', royaltyRate: pct, artistPct: pct / 100, distroLabel: 'IMSS Records', signedDate: '2024-0' + (i % 9 + 1) + '-01', contractExpiration: '2029-12-31', email: '', status: 'Active', contractType: '2026', licenseYears: 5, effectiveDate: '2024-01-01', notes: '', productManager: i % 2 ? 'Sam Okafor' : '', anr: 'Leo Hart', primaryMarket: 'Ghana', secondaryMarket: 'Nigeria', fundingTier: tier, annualBudget: budget,
}));

export const DEMO_CATALOG = [];
export const DEMO_REVENUE = [];
ARTISTS.forEach(([name], ai) => {
  for (let t = 0; t < 3; t++) {
    const title = TITLES[ai * 3 + t];
    const release = MONTHS[t * 2];
    const id = slug(name) + '_' + slug(title);
    DEMO_CATALOG.push({ id, artistId: slug(name), title, type: 'Single', releaseDate: release + '-12', isrc: '', upc: '', status: 'Released', enteredBy: 'Demo', hasVideo: t === 0, licenseExpiration: '', primaryMarket: 'Ghana', secondaryMarket: 'Nigeria' });
    MONTHS.forEach((m, mi) => {
      if (m < release) return;
      const earning = Math.round((40 + rand() * 260) * (1 + mi / 10) * (ai % 3 === 0 ? 1.6 : 1) * 100) / 100;
      // Sales land about two months before the statement (the partner's reporting lag).
      const back = n => { const d = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 - n, 1)); return d.toISOString().slice(0, 7); };
      const salesMonths = { [back(2)]: Math.round(earning * 70) / 100, [back(3)]: Math.round(earning * 30) / 100 };
      DEMO_REVENUE.push({ salesMonths, id: id + '_' + m, artist: name, artistSlug: slug(name), title, month: m, earning, type: 'Single', epAlbum: null, releaseDate: release + '-12', approvalStatus: 'Approved', approvedBy: 'Demo Admin', approvedAt: '2026-01-01' });
    });
  }
});

// Two upcoming releases (dated from today) so the countdown and the
// date-clash note have something to show in the demo.
const inDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
DEMO_CATALOG.push(
  { id: 'nova-reign_ocean-drive', artistId: slug('Nova Reign'), title: 'Ocean Drive', type: 'Single', releaseDate: inDays(4), isrc: '', upc: '', status: 'Upcoming', enteredBy: 'Demo', hasVideo: false, licenseExpiration: '', primaryMarket: 'Ghana', secondaryMarket: '' },
  { id: 'ama-vesper_late-bloom', artistId: slug('Ama Vesper'), title: 'Late Bloom', type: 'EP', releaseDate: inDays(18), isrc: '', upc: '', status: 'Upcoming', enteredBy: 'Demo', hasVideo: false, licenseExpiration: '', primaryMarket: 'Nigeria', secondaryMarket: '' },
);

// Money received each month: what the songs earned plus a little not yet matched to a song.
export const DEMO_MASTER_GROSS = MONTHS.map(m => {
  const tracked = DEMO_REVENUE.filter(r => r.month === m).reduce((a, r) => a + r.earning, 0);
  return { id: m, month: m, totalGross: Math.round(tracked * 1.06 * 100) / 100, swiftFee: tracked > 0 ? 30 : 0 };
});

export const DEMO_NOTICES = [
  { id: 'demo-nt1', title: 'Welcome to the IMSS Records demo', message: 'Everything here is made up. Click around freely: nothing you change reaches the real label.', audience: 'all', createdBy: 'Demo Admin', createdAt: '2026-10-01' },
];

// Publish to artists has work waiting: artists have seen everything up to two
// months ago; the last two months are not published yet, one older month was
// corrected after it was published, and Finance has asked an Admin to approve one.
const HELD = MONTHS.slice(-2);
const seen = DEMO_REVENUE.filter(r => !HELD.includes(r.month));
export const DEMO_PUBLISHED = publishSnapshot(seen.map(r => ({ ...r })), DEMO_REVENUE, DEMO_MASTER_GROSS, DEMO_ROSTER);
const corrected = DEMO_REVENUE.find(r => r.artistSlug === slug('Kofi Lume') && r.month === MONTHS[7]);
if (corrected) corrected.earning = Math.round((corrected.earning + 42.5) * 100) / 100;
const asked = DEMO_REVENUE.filter(r => r.artistSlug === slug('Ama Vesper') && r.month === HELD[0]);
export const DEMO_PUBLISH_LOG = [{
  id: 'demo-pub1', status: 'Awaiting approval', scope: 'selected', note: 'Ama Vesper, first of the new months. Figures checked against the EMPIRE statement.',
  items: [{ key: slug('Ama Vesper') + '|' + HELD[0], artistSlug: slug('Ama Vesper'), artistId: slug('Ama Vesper'), artist: 'Ama Vesper', month: HELD[0], gross: Math.round(asked.reduce((a, r) => a + r.earning, 0) * 100) / 100, state: 'New' }],
  requestedBy: 'Rita Mensah', requestedAt: new Date(Date.UTC(2026, 9, 17, 9, 30)).toISOString(), scheduledFor: '',
}];

// Label rep preview: Kojo Asante (demo-st4) looks after Nova Reign and Kofi
// Lume. Their releases are confirmed to him, and two invoices were sent to him.
const REP_ID = 'demo-st4';
const repArtists = [slug('Nova Reign'), slug('Kofi Lume')];
DEMO_ROSTER.forEach(a => { if (repArtists.includes(a.id)) a.labelRep = REP_ID; });
DEMO_CATALOG.forEach((r, i) => { if (repArtists.includes(r.artistId)) { r.repConfirmedAt = r.releaseDate + 'T10:00:00Z'; r.repFirstConfirmedAt = r.repConfirmedAt; r.isrc = r.isrc || 'GH-IMS-26-' + String(101 + i).padStart(5, '0'); r.upc = r.upc || String(198004500000 + i); } });
export const DEMO_INVOICES = [
  { id: 'demo-inv1', artistId: slug('Nova Reign'), kind: 'service', title: 'Music video shoot, Ocean Drive', amount: 1800, invoiceNumber: 'NR-2026-07', payTo: 'Reel Motion Studios', details: 'Two-day shoot in Accra, crew and gear.', status: 'Finance Queue', submittedAt: '2026-10-10T09:00:00Z', sentToRepAt: '2026-10-14T12:00:00Z', history: [] },
  { id: 'demo-inv2', artistId: slug('Kofi Lume'), kind: 'expense', title: 'Studio session, Highlife EP', amount: 450, invoiceNumber: 'KL-114', payTo: 'Kofi Lume', details: 'Six hours at Bliss Studio.', status: 'DP Queue', submittedAt: '2026-09-28T09:00:00Z', sentToRepAt: '2026-10-02T12:00:00Z', repSentAt: '2026-10-03T08:00:00Z', repRef: 'Sent to partner, ref 8841', history: [] },
];
