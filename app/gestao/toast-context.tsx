"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

type ToastItem = {
  id: number;
  text: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  notify: (text: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue>({
  notify: () => undefined,
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback((text: string, variant: ToastVariant = "success") => {
    const id = nextIdRef.current++;
    setToasts((current) => [...current.slice(-3), { id, text, variant }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div className="nexofab-toast-stack" role="region" aria-label="Avisos do sistema">
          {toasts.map((toast) => {
            const Icon =
              toast.variant === "error"
                ? AlertTriangle
                : toast.variant === "info"
                  ? Info
                  : CheckCircle2;
            return (
              <div
                key={toast.id}
                className={`nexofab-toast ${toast.variant}`}
                role={toast.variant === "error" ? "alert" : "status"}
              >
                <Icon />
                <span>{toast.text}</span>
                <button
                  type="button"
                  aria-label="Fechar aviso"
                  onClick={() => dismiss(toast.id)}
                >
                  <X />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
