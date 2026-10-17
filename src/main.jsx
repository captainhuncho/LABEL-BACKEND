import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { installStorage } from './storage.js';
// The dashboard and portal load after sign-in, so the sign-in page opens fast.
const RecordLabelDashboard = lazy(() => import('./App.jsx'));
import AuthGate from './AuthGate.jsx';
const ArtistApp = lazy(() => import('./ArtistApp.jsx'));
import UpdateBanner from './UpdateBanner.jsx';
import { LegalPage, LEGAL_PATHS } from './Legal.jsx';
import './index.css';
import { stackWideTables } from './stackTables.js';

installStorage();
stackWideTables();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UpdateBanner />
    {/* Legal pages are for people signed in to the platform only. */}
    {LEGAL_PATHS.includes(window.location.pathname.replace(/\/$/, ''))
      ? <AuthGate>{() => <LegalPage page={window.location.pathname.replace(/\/$/, '').slice(1)} />}</AuthGate>
      : <AuthGate>{auth => <Suspense fallback={null}>{auth.access === 'artist' ? <ArtistApp signOut={auth.signOut} /> : <RecordLabelDashboard {...auth} />}</Suspense>}</AuthGate>}
  </React.StrictMode>
);
