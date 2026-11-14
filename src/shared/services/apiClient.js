/**
 * @file apiClient.js
 * @description Centralized Universal HTTP Client for Enterprise Management System (EMS).
 * Automatically injects cryptographically signed Bearer JWT into all outgoing API requests,
 * intercepts 401 / TOKEN_UPGRADE_REQUIRED / SESSION_REVOKED errors, and safely notifies
 * AuthContext to prompt session upgrade without data corruption.
 */

import { API_BASE } from '../config/apiConfig';

const TOKEN_STORAGE_KEY = 'ems_auth_token';
const AUTH_STORAGE_KEY = 'ems_auth_session';

/**
 * Retrieve the current cryptographic JWT token
 * @returns {string|null}
 */
export const getAuthToken = () => {
  try {
    const directToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (directToken && !directToken.startsWith('ems_token_') && directToken.split('.').length === 3) {
      return directToken;
    }

    // Check inside session object
    const rawSession = localStorage.getItem(AUTH_STORAGE_KEY);
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      const sessionToken = parsed?.token || parsed?.jwt;
      if (sessionToken && !sessionToken.startsWith('ems_token_') && sessionToken.split('.').length === 3) {
        return sessionToken;
      }
    }
  } catch (_) {}
  return null;
};

/**
 * Persist the active JWT token
 * @param {string} token
 */
export const setAuthToken = (token) => {
  if (token && typeof token === 'string' && token.split('.').length === 3) {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch (_) {}
  }
};

/**
 * Clear stored auth token
 */
export const clearAuthToken = () => {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch (_) {}
};

/**
 * Build standard headers containing Bearer JWT
 * @param {object} customHeaders
 * @returns {object}
 */
export const getAuthHeaders = (customHeaders = {}) => {
  const headers = { ...customHeaders };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

/**
 * Universal Fetch wrapper with Bearer token injection and centralized 401 handling
 * @param {string} endpoint - Full URL or relative API path (e.g. '/employees' or 'http...')
 * @param {object} options - Fetch options
 * @returns {Promise<Response>}
 */
export const apiFetch = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers = {
    ...(options.headers || {})
  };

  // Only set Content-Type to application/json if body is not FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type'] && options.method && options.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  // Attach Bearer JWT
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  // Handle unauthorized / token expiration / session revocation
  if (response.status === 401) {
    let errJson = null;
    try {
      errJson = await response.clone().json();
    } catch (_) {}

    const code = errJson?.code || 'AUTH_REQUIRED';
    if (code === 'TOKEN_UPGRADE_REQUIRED' || code === 'TOKEN_EXPIRED' || code === 'SESSION_REVOKED') {
      window.dispatchEvent(
        new CustomEvent('ems_auth_invalidation', {
          detail: { code, message: errJson?.message || 'Session expired. Please sign in again.' }
        })
      );
    }
  }

  return response;
};

export const apiClient = {
  get: (endpoint, options = {}) => apiFetch(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) =>
    apiFetch(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body)
    }),
  put: (endpoint, body, options = {}) =>
    apiFetch(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body)
    }),
  patch: (endpoint, body, options = {}) =>
    apiFetch(endpoint, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body)
    }),
  delete: (endpoint, options = {}) => apiFetch(endpoint, { ...options, method: 'DELETE' })
};

export default apiClient;
