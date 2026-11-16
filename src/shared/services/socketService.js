/**
 * @file socketService.js
 * @description Frontend Socket.IO Connection & Real-Time Transport Engine for EMS.
 * Establishes authenticated WebSocket connection using the signed Bearer JWT in the handshake,
 * manages automatic reconnection, room event subscriptions, and prevents duplicate connections.
 */

import { io } from 'socket.io-client';
import { getAuthToken } from './apiClient';

let socketInstance = null;
let isConnecting = false;
const eventListeners = new Map();

/**
 * Resolve the backend WebSocket URL from environment or known deployment endpoints
 * @returns {string}
 */
export const getSocketServerUrl = () => {
  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem('ems_socket_url') || localStorage.getItem('ems_backend_url');
    if (customUrl && typeof customUrl === 'string' && customUrl.trim()) {
      return customUrl.trim().replace(/\/api\/?$/, '').replace(/\/+$/, '');
    }
  }

  const envSocketUrl = import.meta.env?.VITE_SOCKET_URL;
  if (envSocketUrl && typeof envSocketUrl === 'string' && envSocketUrl.trim()) {
    return envSocketUrl.trim().replace(/\/+$/, '');
  }

  const envApiUrl = import.meta.env?.VITE_API_URL;
  if (envApiUrl && typeof envApiUrl === 'string' && envApiUrl.trim()) {
    return envApiUrl.trim().replace(/\/api\/?$/, '');
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host);

    if (isLocal) {
      return `http://${host}:5000`;
    }
    return 'https://ems-backend-7zpi.onrender.com';
  }

  return 'http://localhost:5000';
};

/**
 * Initialize and connect the Socket.IO client instance using the current JWT token
 * @returns {import('socket.io-client').Socket|null}
 */
export const initSocket = () => {
  const token = getAuthToken();
  if (!token) {
    if (socketInstance) {
      disconnectSocket();
    }
    return null;
  }

  // If already connected or connecting with the same token, reuse instance
  if (socketInstance?.connected) {
    return socketInstance;
  }

  if (isConnecting && socketInstance) {
    return socketInstance;
  }

  isConnecting = true;
  const serverUrl = getSocketServerUrl();

  try {
    if (socketInstance) {
      socketInstance.removeAllListeners();
      socketInstance.disconnect();
    }

    socketInstance = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    socketInstance.on('connect', () => {
      isConnecting = false;
      console.log('⚡ [Socket.IO] Connected to EMS real-time server:', socketInstance.id);
      window.dispatchEvent(new CustomEvent('ems_socket_status', { detail: { connected: true, id: socketInstance.id } }));
    });

    socketInstance.on('auth:confirmed', (data) => {
      console.log('🔒 [Socket.IO] Authenticated handshake verified for user:', data?.userId, 'Rooms:', data?.rooms);
    });

    socketInstance.on('connect_error', (err) => {
      isConnecting = false;
      console.warn('⚠️ [Socket.IO] Connection error:', err.message);

      if (err.message?.includes('TOKEN_EXPIRED') || err.message?.includes('SESSION_REVOKED') || err.message?.includes('TOKEN_UPGRADE_REQUIRED')) {
        window.dispatchEvent(
          new CustomEvent('ems_auth_invalidation', {
            detail: { code: 'SOCKET_AUTH_FAILED', message: err.message }
          })
        );
      }
    });

    socketInstance.on('disconnect', (reason) => {
      isConnecting = false;
      console.log('🔌 [Socket.IO] Disconnected:', reason);
      window.dispatchEvent(new CustomEvent('ems_socket_status', { detail: { connected: false, reason } }));
    });

    // Reattach all dynamic event listeners
    for (const [eventName, callbacks] of eventListeners.entries()) {
      for (const cb of callbacks) {
        socketInstance.on(eventName, cb);
      }
    }

    return socketInstance;
  } catch (err) {
    isConnecting = false;
    console.error('Failed to initialize socket connection:', err);
    return null;
  }
};

/**
 * Retrieve the active socket client instance
 * @returns {import('socket.io-client').Socket|null}
 */
export const getSocket = () => {
  if (!socketInstance?.connected && getAuthToken()) {
    return initSocket();
  }
  return socketInstance;
};

/**
 * Disconnect and destroy the socket connection
 */
export const disconnectSocket = () => {
  if (socketInstance) {
    try {
      socketInstance.removeAllListeners();
      socketInstance.disconnect();
    } catch (_) {}
    socketInstance = null;
    isConnecting = false;
  }
};

/**
 * Subscribe to a socket event safely
 * @param {string} eventName
 * @param {Function} callback
 * @returns {Function} Unsubscribe function
 */
export const subscribeSocketEvent = (eventName, callback) => {
  if (!eventName || typeof callback !== 'function') return () => {};

  if (!eventListeners.has(eventName)) {
    eventListeners.set(eventName, new Set());
  }
  eventListeners.get(eventName).add(callback);

  if (socketInstance) {
    socketInstance.on(eventName, callback);
  }

  return () => {
    const set = eventListeners.get(eventName);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        eventListeners.delete(eventName);
      }
    }
    if (socketInstance) {
      socketInstance.off(eventName, callback);
    }
  };
};

export default {
  initSocket,
  getSocket,
  disconnectSocket,
  subscribeSocketEvent,
  getSocketServerUrl
};
