/**
 * @file apiConfig.js
 * @description Centralized Universal API Base URL Resolver for Enterprise Management System (EMS).
 * Automatically normalizes Render / Vercel / Localhost environment variables to ensure 100% reliable connectivity.
 */

export function getApiBaseUrl() {
  const envUrl = import.meta.env?.VITE_API_URL;
  
  if (!envUrl || typeof envUrl !== 'string' || !envUrl.trim()) {
    return '/api';
  }

  const cleanUrl = envUrl.trim().replace(/\/+$/, '');

  // If the user already provided `/api` in their environment variable, preserve it
  if (cleanUrl.endsWith('/api')) {
    return cleanUrl;
  }

  // Otherwise append `/api`
  return `${cleanUrl}/api`;
}

export const API_BASE = getApiBaseUrl();
