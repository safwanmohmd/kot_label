import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const Ctx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, kind = 'info') => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  const dismiss = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 no-print">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-slide-in flex items-start gap-3 rounded-lg border border-ink-200 bg-white px-4 py-3 shadow-elevated min-w-[280px] max-w-[400px]"
          >
            {t.kind === 'success' && <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />}
            {t.kind === 'error' && <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />}
            {t.kind === 'info' && <Info className="h-5 w-5 text-brand-600 flex-shrink-0" />}
            <p className="text-sm text-ink-800 flex-1">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-ink-400 hover:text-ink-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.toast;
}
