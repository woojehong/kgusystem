import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(() => {});

/** Hook returning a `toast(message, type?)` function. type: 'success' | 'error'. */
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = 'success') => {
    if (!message) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((list) => [...list, { id, message, type }]);
    setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`kwgu-toast-in pointer-events-auto w-fit max-w-[90vw] px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg border backdrop-blur ${
              t.type === 'error'
                ? 'bg-red-500/15 border-red-500/40 text-red-200'
                : 'bg-green-500/15 border-green-500/40 text-green-200'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
