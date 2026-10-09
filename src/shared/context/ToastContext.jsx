import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((input, type = 'success', duration = 3500) => {
    const id = Date.now() + Math.random();
    let text = '';
    let toastType = type;

    if (input && typeof input === 'object') {
      if (input.message && typeof input.message === 'string') {
        text = input.title ? `${input.title}: ${input.message}` : input.message;
      } else if (input.title && typeof input.title === 'string') {
        text = input.title;
      } else if (input instanceof Error) {
        text = input.message || 'An unexpected error occurred';
      } else {
        text = JSON.stringify(input);
      }
      if (input.type) toastType = input.type;
    } else {
      text = String(input || 'Action completed');
    }

    setToasts(prev => [...prev, { id, message: text, type: toastType }]);

    if (duration) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'none'
      }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 18px',
              borderRadius: '8px',
              background: '#101b33',
              color: '#ffffff',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              fontSize: '13px',
              fontWeight: '500',
              borderLeft: toast.type === 'success' ? '4px solid #10b981' : (toast.type === 'error' ? '4px solid #ef4444' : '4px solid #3b82f6'),
              animation: 'fadeIn 0.25s ease forwards',
              minWidth: '280px',
              maxWidth: '420px'
            }}
          >
            {toast.type === 'success' && <CheckCircle2 size={18} color="#10b981" />}
            {toast.type === 'error' && <AlertCircle size={18} color="#ef4444" />}
            {toast.type === 'info' && <Info size={18} color="#3b82f6" />}
            <span style={{ flex: 1 }}>{typeof toast.message === 'string' ? toast.message : String(toast.message || '')}</span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                padding: '2px'
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
