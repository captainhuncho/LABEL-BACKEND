import React from 'react';
import { createRoot } from 'react-dom/client';
import { installStorage } from './storage.js';
import RecordLabelDashboard from './App.jsx';
import './index.css';

installStorage();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RecordLabelDashboard />
  </React.StrictMode>
);
