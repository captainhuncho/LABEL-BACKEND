import React from 'react';
import { createRoot } from 'react-dom/client';
import { installStorage } from './storage.js';
import RecordLabelDashboard from './App.jsx';
import AuthGate from './AuthGate.jsx';
import ArtistApp from './ArtistApp.jsx';
import UpdateBanner from './UpdateBanner.jsx';
import { LegalPage, LEGAL_PATHS } from './Legal.jsx';
import './index.css';

installStorage();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UpdateBanner />
    {/* Legal pages are public: no sign-in needed. */}
    {LEGAL_PATHS.includes(window.location.pathname.replace(/\/$/, ''))
      ? <LegalPage page={window.location.pathname.replace(/\/$/, '').slice(1)} />
      : <AuthGate>{auth => auth.access === 'artist' ? <ArtistApp signOut={auth.signOut} /> : <RecordLabelDashboard {...auth} />}</AuthGate>}
  </React.StrictMode>
);
