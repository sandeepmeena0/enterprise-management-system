import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './shared/styles/index.css';
import { initStorage } from './shared/services/storageService';

// Automatically recover from new deployments if a chunk fails to load without manual Ctrl+Shift+R
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    console.warn('[Vite] Dynamic import preload error detected. Reloading for newest deployment...', event);
    window.location.reload();
  });
}

// Initialize storage seed data on app start
initStorage();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
