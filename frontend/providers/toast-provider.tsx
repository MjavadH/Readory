'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Toast, ToastType } from '@/components/toast';

type ToastItem = {
  id: number;
  title?: string;
  message: string;
  type: ToastType;
  duration?: number;
};

type ShowToastInput = {
  title?: string;
  message: string;
  type: ToastType;
  duration?: number;
};

type ToastContextType = {
  showToast: (input: ShowToastInput) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

const MAX_TOASTS = 3;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((input: ShowToastInput) => {
    const id = idRef.current++;
    const newToast: ToastItem = { id, ...input };

    setToasts((prev) => {
      const next = [...prev, newToast];
      // فقط آخرین 3 تا نگه داشته شود (قدیمی‌ترین حذف می‌شود)
      return next.slice(-MAX_TOASTS);
    });
  }, []);

  const success = useCallback(
    (message: string, title?: string) => showToast({ message, title, type: 'success' }),
    [showToast],
  );

  const error = useCallback(
    (message: string, title?: string) => showToast({ message, title, type: 'error' }),
    [showToast],
  );

  const info = useCallback(
    (message: string, title?: string) => showToast({ message, title, type: 'info' }),
    [showToast],
  );

  const warning = useCallback(
    (message: string, title?: string) => showToast({ message, title, type: 'warning' }),
    [showToast],
  );

  const value = useMemo(
    () => ({ showToast, success, error, info, warning }),
    [showToast, success, error, info, warning],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="fixed right-4 top-4 z-[9999] flex w-[calc(100vw-2rem)] max-w-md flex-col gap-3">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            title={toast.title}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return ctx;
}
