import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, icon, children, actions }) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="sketch-panel bg-white p-6 max-w-md w-full mx-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded transition-colors"
          title="Close"
        >
          <X size={20} className="text-gray-500" />
        </button>

        {/* Title with optional icon */}
        {title && (
          <div className="flex items-center gap-3 mb-4 pr-8">
            {icon && <div className="text-[#f08080]">{icon}</div>}
            <h2 className="text-2xl font-bold -rotate-1" style={{ fontFamily: 'Comic Sans MS, cursive' }}>
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
  const confirmClasses = confirmStyle === "danger"
    ? "bg-red-500 hover:bg-red-600 text-white"
    : "bg-[#f08080] hover:bg-[#e07070] text-white";

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
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded font-medium transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 rounded font-medium transition-colors ${confirmClasses}`}
          >
            {confirmText}
          </button>
        </>
      }
    >
      <p className="text-gray-700 whitespace-pre-line">{message}</p>
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
          className="px-4 py-2 bg-[#f08080] hover:bg-[#e07070] text-white rounded font-medium transition-colors"
        >
          {buttonText}
        </button>
      }
    >
      <p className="text-gray-700 whitespace-pre-line">{message}</p>
    </Modal>
  );
}
