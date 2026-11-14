/**
 * @file ForgotPasswordModal.jsx
 * @description Secure Password Recovery Request Modal on the login page.
 * Submits an authenticated or unauthenticated request to the backend (/api/auth/forgot-password),
 * creating an official Admin review ticket in MongoDB without exposing credentials or account existence.
 */

import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, HelpCircle, X, ArrowLeft } from 'lucide-react';
import { API_BASE } from '../../config/apiConfig';

export const ForgotPasswordModal = ({ isOpen, onClose }) => {
  const [identifier, setIdentifier] = useState('');
  const [status, setStatus] = useState(null); // null | 'submitted' | 'error'
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleResetRequest = async (e) => {
    e.preventDefault();
    const cleanId = identifier.trim();
    if (!cleanId) return;

    setIsSubmitting(true);
    setStatus(null);
    setStatusMessage('');

    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: cleanId })
      });

      const json = await res.json().catch(() => ({}));

      if (res.status === 429) {
        setStatus('error');
        setStatusMessage(json.message || 'Too many requests. Please try again later.');
        setIsSubmitting(false);
        return;
      }

      // Generic success state (anti-enumeration policy)
      setStatus('submitted');
      setStatusMessage(
        json.message ||
        'If an active account matches that identifier, a password reset request has been submitted to the Administrator.'
      );
    } catch (err) {
      console.warn('[ForgotPassword] Request error:', err);
      // Even on network error, maintain safety
      setStatus('error');
      setStatusMessage('Unable to reach the server. Please check your network connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIdentifier('');
    setStatus(null);
    setStatusMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-[1200] p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-[14px] w-full max-w-[440px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <HelpCircle size={17} />
            </div>
            <div>
              <h3 className="m-0 text-[15px] font-extrabold text-slate-900 dark:text-slate-100">
                Forgot Your Password?
              </h3>
              <p className="m-0 mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
                Account recovery and password reset assistance.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="bg-transparent border-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5">
          {status === 'submitted' ? (
            <div className="flex flex-col gap-3.5 text-center items-center">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-950/60 text-green-600 dark:text-green-400 flex items-center justify-center">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h4 className="m-0 mb-1.5 text-[15px] font-extrabold text-slate-900 dark:text-slate-100">
                  Request Submitted
                </h4>
                <p className="m-0 text-[12.5px] text-slate-600 dark:text-slate-300 leading-normal">
                  {statusMessage}
                </p>
                <div className="mt-3 p-2.5 px-3.5 bg-sky-50 dark:bg-sky-950/40 rounded-lg border border-sky-200 dark:border-sky-800 text-xs text-sky-800 dark:text-sky-300 text-left leading-relaxed">
                  ℹ️ Your Workspace Administrator can review the request ticket in their CRM Dashboard and set a new secure password from the <strong>Employee Directory</strong>.
                </div>
              </div>

              <button
                onClick={handleClose}
                className="w-full py-2.5 rounded-[7px] bg-blue-600 hover:bg-blue-700 text-white border-0 text-[13px] font-bold cursor-pointer mt-1.5 shadow-sm transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft size={15} />
                <span>Back to Sign In</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetRequest} className="flex flex-col gap-3.5">
              <p className="m-0 text-[12.5px] text-slate-500 dark:text-slate-400 leading-normal">
                Enter your registered <strong>Work Email</strong> or <strong>Employee ID</strong> (e.g. <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">EMP-001</code>). An official reset request ticket will be submitted to the Workspace Administrator.
              </p>

              {status === 'error' && (
                <div className="p-2.5 px-3 rounded-[7px] bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-center gap-1.5">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{statusMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Work Email or Employee ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={e => {
                    setIdentifier(e.target.value);
                    if (status) setStatus(null);
                  }}
                  placeholder="e.g. sandeep@inforag.com or EMP-001"
                  required
                  autoFocus
                  className="w-full py-2 px-3 rounded-[7px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[13px] text-slate-900 dark:text-slate-100 outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 box-border transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3.5 py-2 rounded-[7px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !identifier.trim()}
                  className="px-4 py-2 rounded-[7px] border-0 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold cursor-pointer shadow-sm transition-colors disabled:opacity-60"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordModal;
