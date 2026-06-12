import { useEffect } from 'react';

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`w-full ${maxWidth} max-h-[92vh] overflow-y-auto card rounded-b-none sm:rounded-2xl p-5 sm:p-6 shadow-2xl`}
      >
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-base-700 text-base-400 hover:text-base-100 transition"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
