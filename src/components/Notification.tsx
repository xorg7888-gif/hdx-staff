/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, AlertCircle, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  text: string;
}

interface NotificationProps {
  toast: ToastMessage | null;
  onClear: () => void;
}

export function Notification({ toast, onClear }: NotificationProps) {
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        onClear();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast, onClear]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
        >
          <div
            id={`toast-${toast.id}`}
            className={`flex items-start gap-3 p-4 rounded-2xl border shadow-xl backdrop-blur-md ${
              toast.type === "success"
                ? "bg-emerald-50/95 dark:bg-emerald-950/95 border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
                : toast.type === "error"
                ? "bg-rose-50/95 dark:bg-rose-950/95 border-rose-500/30 text-rose-800 dark:text-rose-200"
                : "bg-blue-50/95 dark:bg-blue-950/95 border-blue-500/30 text-blue-800 dark:text-blue-200"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            )}
            
            <div className="flex-1 text-sm font-medium leading-relaxed">
              {toast.text}
            </div>

            <button
              onClick={onClear}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors p-1 rounded-lg hover:bg-neutral-500/10 shrink-0"
              aria-label="Dismiss message"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
