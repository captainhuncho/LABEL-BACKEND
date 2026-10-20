import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { installStorage, supabase } from './storage.js';
// The dashboard and portal load after sign-in, so the sign-in page opens fast.
const RecordLabelDashboard = lazy(() => import('./App.jsx'));
import AuthGate from './AuthGate.jsx';
const ArtistApp = lazy(() => import('./ArtistApp.jsx'));
const RepApp = lazy(() => import('./RepApp.jsx'));
import UpdateBanner from './UpdateBanner.jsx';
import { LegalPage, LEGAL_PATHS } from './Legal.jsx';
import './index.css';
import { stackWideTables } from './stackTables.js';
import { installErrorReport } from './errorReport.js';
import { installPullToRefresh } from './pullToRefresh.js';
import LoadingScreen from './LoadingScreen.jsx';
import { applyAppearance } from './appearance.js';

applyAppearance();
installStorage();
installErrorReport();
installPullToRefresh();
// One app, two addresses: the artist address names itself in the browser tab.
if (window.location.hostname.startsWith('artist.')) document.title = 'IMSS Records — For Artists';
stackWideTables();

// Production fails closed: without the Supabase settings it never falls back to
// this browser's local storage (data would look saved but be private to one
// device). Local development and the demo build (VITE_DEMO=1) keep local mode.
const misconfigured = import.meta.env.PROD && import.meta.env.VITE_DEMO !== '1' && !supabase;

// Dev only: ?loading=ops|artist|rep shows the loading screen on its own.
const previewLoading = import.meta.env.DEV && new URLSearchParams(window.location.search).get('loading');
if (misconfigured) createRoot(document.getElementById('root')).render(
  <main role="alert" style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 440, margin: '20vh auto', padding: 16, textAlign: 'center' }}>
    <h1 style={{ fontSize: 22 }}>IMSS Records is unavailable</h1>
    <p>This site isn’t connected to its database, so it won’t open. Please contact the label.</p>
  </main>
);
else if (previewLoading) createRoot(document.getElementById('root')).render(<LoadingScreen variant={previewLoading} />);
else createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UpdateBanner />
    {/* Legal pages are for people signed in to the platform only. */}
    {LEGAL_PATHS.includes(window.location.pathname.replace(/\/$/, ''))
      ? <AuthGate>{() => <LegalPage page={window.location.pathname.replace(/\/$/, '').slice(1)} />}</AuthGate>
      : <AuthGate>{auth => <Suspense fallback={<LoadingScreen variant={auth.access === 'artist' ? 'artist' : auth.access === 'rep' ? 'rep' : 'ops'} />}>{auth.access === 'artist' ? <ArtistApp signOut={auth.signOut} /> : auth.access === 'rep' ? <RepApp signOut={auth.signOut} /> : <RecordLabelDashboard {...auth} />}</Suspense>}</AuthGate>}
  </React.StrictMode>
);
