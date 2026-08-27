"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string | null;
  onClose: () => void;
}

export function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 2800);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="fixed left-0 right-0 z-[80] flex justify-center px-4 pointer-events-none"
      style={{ bottom: "max(5.5rem, calc(env(safe-area-inset-bottom) + 4.5rem))" }}
    >
      <div className="pointer-events-auto max-w-sm w-full scale-in rounded-2xl glass-strong border border-white/12 px-4 py-3 text-center text-sm text-white/90 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        {message}
      </div>
    </div>
  );
}
