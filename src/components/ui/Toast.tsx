"use client";

import { useEffect, useState } from "react";

interface ToastProps {
  message: string | null;
  onClose: () => void;
  durationMs?: number;
}

/**
 * Auto-hides. Uses message identity + local visible state so parent
 * re-renders (polling) do NOT reset the dismiss timer.
 */
export function Toast({ message, onClose, durationMs = 2600 }: ToastProps) {
  const [visible, setVisible] = useState<string | null>(null);

  useEffect(() => {
    if (!message) {
      setVisible(null);
      return;
    }
    setVisible(message);
    const t = setTimeout(() => {
      setVisible(null);
      onClose();
    }, durationMs);
    return () => clearTimeout(t);
    // only re-arm when the *text* changes, not when onClose identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, durationMs]);

  if (!visible) return null;

  return (
    <div
      className="fixed left-0 right-0 z-[80] flex justify-center px-4 pointer-events-none"
      style={{
        bottom: "max(5.5rem, calc(env(safe-area-inset-bottom) + 4.5rem))",
      }}
    >
      <div
        className="pointer-events-auto max-w-sm w-full scale-in rounded-2xl glass-strong border border-white/12 px-4 py-3 text-center text-sm text-white/90 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
        onClick={() => {
          setVisible(null);
          onClose();
        }}
      >
        {visible}
      </div>
    </div>
  );
}
