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
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[100] max-w-[90%] scale-in">
      <div className="glass-strong rounded-2xl px-5 py-3 shadow-2xl border border-white/10">
        <p className="text-sm font-medium text-center whitespace-nowrap">
          {message}
        </p>
      </div>
    </div>
  );
}
