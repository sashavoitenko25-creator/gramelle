"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface ToastProps {
  message: string | null;
  onClose: () => void;
}

export function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 2200);
    return () => clearTimeout(t);
  }, [message, onClose]);

  return (
    <div
      className={cn(
        "fixed top-16 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-full",
        "bg-white text-black text-sm font-medium shadow-lg transition-all duration-300",
        message ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
      )}
    >
      {message}
    </div>
  );
}
