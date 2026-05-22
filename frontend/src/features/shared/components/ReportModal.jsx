import React, { useState } from 'react';
import { CheckCircle2, Flag, Loader2 } from 'lucide-react';
import { submitReport } from '../services/reportApi';

const REASON_OPTIONS = [
  'Misinformation / Fake News',
  'Harassment or Hate Speech',
  'Spam or Irrelevant Content',
  'Inappropriate or Offensive Content',
  'Impersonation',
  'Other',
];

/**
 * Modal for submitting content reports.
 * @param {{ isOpen: boolean, onClose: () => void, targetType: string, targetId: string, targetLabel?: string }} props
 * @returns {JSX.Element | null}
 */
export default function ReportModal({ isOpen, onClose, targetType, targetId, targetLabel }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [submitError, setSubmitError] = useState('');

  if (!isOpen) {
    return null;
  }

  const resetState = () => {
    setReason('');
    setDetails('');
    setReasonError('');
    setIsSubmitting(false);
    setSuccessMessage('');
    setSubmitError('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setReasonError('');
    setSubmitError('');

    if (!reason) {
      setReasonError('Please select a reason.');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitReport({
        targetType,
        targetId,
        targetLabel,
        reason,
        details,
      });
      setSuccessMessage('Report submitted. Thank you for helping keep NewsHub safe.');
      window.setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      setSubmitError(error?.message || 'Failed to submit report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
      >
        {successMessage ? (
          <div className="flex flex-col items-center justify-center text-center gap-3 py-4">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
            <p className="text-sm text-slate-700">{successMessage}</p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <Flag className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <h2 id="report-modal-title" className="text-lg font-bold text-slate-900 truncate">
                  Report {targetLabel || 'content'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">Help us keep NewsHub safe and accurate.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="report-reason" className="block text-sm font-medium text-slate-700 mb-1">
                  Reason <span className="text-rose-500">*</span>
                </label>
                <select
                  id="report-reason"
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setReasonError('');
                  }}
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 bg-white"
                >
                  <option value="" disabled>
                    Select a reason...
                  </option>
                  {REASON_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {reasonError ? <p className="text-xs text-rose-600 mt-1">{reasonError}</p> : null}
              </div>

              <div>
                <label htmlFor="report-details" className="block text-sm font-medium text-slate-700 mb-1">
                  Additional details
                </label>
                <textarea
                  id="report-details"
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  placeholder="Additional details (optional) — max 500 characters"
                  maxLength={500}
                  rows={3}
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-lg bg-rose-600 text-white font-semibold text-sm hover:bg-rose-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Submit Report
              </button>

              {submitError ? <p className="text-sm text-rose-600 text-center">{submitError}</p> : null}
            </form>

            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="w-full text-sm text-slate-500 hover:text-slate-700 disabled:opacity-60"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
