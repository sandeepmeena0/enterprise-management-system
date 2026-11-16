/**
 * @file apiConfig.js
 * @description Centralized Universal API Base URL Resolver for Enterprise Management System (EMS).
 * Automatically normalizes Render / Vercel / Localhost environment variables to ensure 100% reliable connectivity.
 */

export function getApiBaseUrl() {
  const envUrl = import.meta.env?.VITE_API_URL;
  
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    const cleanUrl = envUrl.trim().replace(/\/+$/, '');
    return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
  }

  // Universal Hostname Auto-Resolution for Frontend Deploys
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host);

    // In local development or local network, Vite dev proxy handles /api
    if (isLocal) {
      return '/api';
    }

    // When deployed on any remote domain / main link (Vercel, Netlify, Custom Domain) without VITE_API_URL
    return 'https://ems-backend-7zpi.onrender.com/api';
  }

  return '/api';
}

export const API_BASE = getApiBaseUrl();
