import { useEffect, useRef } from 'react';

// Comic-style confirmation dialog (replaces the browser's window.confirm).
export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }) {
  const confirmRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    // For destructive actions, default focus goes to the safe choice (cancel).
    (danger ? cancelRef.current : confirmRef.current) && (danger ? cancelRef.current : confirmRef.current).focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel && onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel, danger]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel && onCancel()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h3 id="modal-title" className="display">{title}</h3>
        {message && <p className="muted">{message}</p>}
        <div className="row modal-actions">
          <button type="button" ref={cancelRef} className="ghost" onClick={onCancel}>{cancelLabel}</button>
          <button
            type="button"
            ref={confirmRef}
            className={danger ? 'primary danger-btn' : 'primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
