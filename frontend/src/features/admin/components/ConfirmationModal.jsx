// frontend/src/features/admin/components/ConfirmationModal.jsx
import React, { useEffect, useRef } from 'react';

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmClassName,
  onConfirm,
  onCancel,
  isConfirming,
  showReasonInput = false,  // NEW: when true, renders reason textarea below message
  reason = '',              // NEW: controlled textarea value
  onReasonChange,           // NEW: (value: string) => void — called on textarea change
}) {
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (isOpen && cancelButtonRef.current) {
      cancelButtonRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isOpen || isConfirming) return;
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isConfirming, onCancel]);

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (!isConfirming) {
      onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        className="w-full max-w-md rounded-xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-5 sm:p-6 space-y-3">
          <h2 id="confirmation-modal-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <p className="text-sm text-slate-600">
            {message}
          </p>
          {/* NEW: optional reason textarea — only rendered when showReasonInput is true */}
          {showReasonInput ? (
            <div className="pt-1">
              <label
                htmlFor="confirmation-reason"
                className="block text-xs font-medium text-slate-500 mb-1"
              >
                Reason <span className="text-slate-400">(optional)</span>
              </label>
              <textarea
                id="confirmation-reason"
                rows={3}
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
                placeholder="Provide a reason that will be shown to the user..."
                disabled={isConfirming}
                className="w-full rounded-lg border border-slate-200 px-3 py-2
                           text-sm text-slate-900 placeholder:text-slate-400
                           focus:outline-none focus:ring-2 focus:ring-blue-200
                           disabled:opacity-60 resize-none"
                maxLength={500}
              />
              <p className="text-right text-xs text-slate-400 mt-0.5">
                {(reason || '').length} / 500
              </p>
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 pb-5 sm:px-6 sm:pb-6">
          <button
            type="button"
            ref={cancelButtonRef}
            onClick={onCancel}
            disabled={isConfirming}
            className="px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason)}  // CHANGED: passes reason to caller (undefined when showReasonInput is false — callers default with reason = '')
            disabled={isConfirming}
            className={`${confirmClassName} px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60`}
          >
            {isConfirming ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
