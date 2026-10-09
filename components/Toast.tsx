"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { IconCheck, IconClose } from "./icons";

type Toast = { id: number; message: string; tone: "ok" | "bad" | "info" };
type ToastApi = { push: (message: string, tone?: Toast["tone"]) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-host" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone === "ok" ? "ok" : t.tone === "bad" ? "bad" : ""}`}>
            <div className="row" style={{ gap: 10 }}>
              {t.tone === "ok" ? <IconCheck size={16} /> : null}
              <span className="grow">{t.message}</span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                style={{ padding: 4 }}
                onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
                aria-label="Dismiss"
              >
                <IconClose size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  return ctx ?? { push: () => {} };
}

/** Shows a toast whenever an action result changes. */
export function useActionToast(state: { ok?: boolean; message?: string; error?: string } | undefined) {
  const { push } = useToast();
  useEffect(() => {
    if (!state) return;
    if (state.message) push(state.message, state.ok === false ? "bad" : "ok");
    else if (state.error) push(state.error, "bad");
  }, [state, push]);
}
