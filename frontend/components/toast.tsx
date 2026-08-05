import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

type ToastProps = {
  message: string;
  type: ToastType;
  onClose: () => void;
  title?: string;
  duration?: number;
};

export function Toast({ title, message, type, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const styles = {
    success:
      'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
    error:
      'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
    info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100',
    warning:
      'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
  } as const;

  const Icon =
    type === 'success'
      ? CheckCircle2
      : type === 'error'
        ? AlertCircle
        : type === 'info'
          ? Info
          : TriangleAlert;

  return (
    <div className="animate-in slide-in-from-top-5 fade-in-0">
      <div
        className={`flex w-full max-w-md items-start gap-3 rounded-xl border p-4 shadow-lg ${styles[type]}`}
        role="status"
        aria-live="polite"
      >
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />

        <div className="min-w-0 flex-1">
          {title ? <p className="mb-1 text-sm font-semibold leading-5">{title}</p> : null}
          <p className="text-sm leading-5 opacity-95">{message}</p>
        </div>

        <button
          onClick={onClose}
          className="shrink-0 rounded-lg p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          aria-label="Close toast"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
