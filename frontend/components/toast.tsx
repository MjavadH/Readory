import {useEffect} from "react";
import {AlertCircle, Check, X} from "lucide-react";


export function Toast({message, type, onClose,}: {
    message: string;
    type: 'error' | 'success';
    onClose: () => void;
}) {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="fixed right-4 top-4 z-9999 animate-in slide-in-from-top-5">
            <div
                className={`flex max-w-md items-start gap-3 rounded-xl border p-4 shadow-lg ${
                    type === 'error'
                        ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100'
                }`}
            >
                {type === 'error' ? (
                    <AlertCircle className="h-5 w-5 shrink-0" />
                ) : (
                    <Check className="h-5 w-5 shrink-0" />
                )}
                <p className="flex-1 text-sm font-medium">{message}</p>
                <button
                    onClick={onClose}
                    className="shrink-0 rounded-lg p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}