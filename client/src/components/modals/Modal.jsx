import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, icon, children, actions }) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="sketch-panel paper-card p-6 max-w-md w-full mx-4 relative font-body text-[color:var(--ink)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded transition-colors text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] hover:bg-[color:color-mix(in_srgb,var(--ink)_8%,transparent)]"
          title="Close"
        >
          <X size={20} />
        </button>

        {/* Title with optional icon */}
        {title && (
          <div className="flex items-center gap-3 mb-4 pr-8">
            {icon && <div className="text-[color:var(--coral)]">{icon}</div>}
            <h2 className="font-display text-2xl -rotate-1 text-[color:var(--ink)]">
              {title}
            </h2>
          </div>
        )}

        {/* Content */}
        <div className="mb-6">
          {children}
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex gap-3 justify-end">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

// Confirm dialog variant
export function ConfirmModal({ isOpen, onClose, onConfirm, onCancel, title, icon, message, confirmText = "OK", cancelText = "Cancel", confirmStyle = "primary" }) {
  const confirmClasses = confirmStyle === "danger" ? "btn-danger" : "btn-coral";

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      icon={icon}
      actions={
        <>
          <button
            onClick={handleCancel}
            className="btn-ghost focus-sketch !text-base !py-2"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`${confirmClasses} focus-sketch !text-base !py-2`}
          >
            {confirmText}
          </button>
        </>
      }
    >
      <p className="text-[color:var(--ink)] whitespace-pre-line">{message}</p>
    </Modal>
  );
}

// Alert dialog variant
export function AlertModal({ isOpen, onClose, title, icon, message, buttonText = "OK" }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      icon={icon}
      actions={
        <button
          onClick={onClose}
          className="btn-coral focus-sketch !text-base !py-2"
        >
          {buttonText}
        </button>
      }
    >
      <p className="text-[color:var(--ink)] whitespace-pre-line">{message}</p>
    </Modal>
  );
}
