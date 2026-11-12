"use client";

import { useSession } from "@/lib/store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

const client = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } });

export function Providers({ children }: { children: React.ReactNode }) {
  const toasts = useSession((state) => state.toasts);
  const dismiss = useSession((state) => state.dismiss);
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
  }, []);
  useEffect(() => {
    if (!toasts.length) return;
    const timer = window.setTimeout(() => dismiss(toasts[0].id), 3200);
    return () => window.clearTimeout(timer);
  }, [toasts, dismiss]);
  return (
    <QueryClientProvider client={client}>
      {children}
      <div className="fixed bottom-20 right-4 z-50 space-y-2 md:bottom-6">
        {toasts.map((toast) => (
          <button key={toast.id} onClick={() => dismiss(toast.id)} className={`block rounded-xl px-4 py-2 text-sm text-white shadow-card ${toast.tone === "err" ? "bg-[#d14343]" : "bg-[#1c1f23]"}`}>
            {toast.text}
          </button>
        ))}
      </div>
    </QueryClientProvider>
  );
}

export function useHydratedSession() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const store = useSession.persist;
    if (!store || store.hasHydrated()) {
      setReady(true);
      return;
    }
    return store.onFinishHydration(() => setReady(true));
  }, []);
  return ready;
}
