// Made-up label for the demo site (built with VITE_DEMO=1): fictional artists,
// songs and money. Nothing here is real; the real data is never in a demo build.
import { ONBOARDING_TASKS_TEMPLATE, defaultPermissionsForRole } from './constants.js';
import { slug } from './finance.js';

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
  ['Demo Admin', 'Admin'], ['Sam Okafor', 'Product Manager'], ['Rita Mensah', 'Finance'], ['Leo Hart', 'A&R'],
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
      DEMO_REVENUE.push({ id: id + '_' + m, artist: name, artistSlug: slug(name), title, month: m, earning, type: 'Single', epAlbum: null, releaseDate: release + '-12', approvalStatus: 'Approved', approvedBy: 'Demo Admin', approvedAt: '2026-01-01' });
    });
  }
});

// Money received each month: what the songs earned plus a little not yet matched to a song.
export const DEMO_MASTER_GROSS = MONTHS.map(m => {
  const tracked = DEMO_REVENUE.filter(r => r.month === m).reduce((a, r) => a + r.earning, 0);
  return { id: m, month: m, totalGross: Math.round(tracked * 1.06 * 100) / 100, swiftFee: tracked > 0 ? 30 : 0 };
});

export const DEMO_NOTICES = [
  { id: 'demo-nt1', title: 'Welcome to the IMSS Records demo', message: 'Everything here is made up. Click around freely: nothing you change reaches the real label.', audience: 'all', createdBy: 'Demo Admin', createdAt: '2026-10-01' },
];
