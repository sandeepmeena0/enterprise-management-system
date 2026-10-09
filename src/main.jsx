import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './shared/styles/index.css';
import { initStorage } from './shared/services/storageService';

// Initialize storage seed data on app start
initStorage();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
