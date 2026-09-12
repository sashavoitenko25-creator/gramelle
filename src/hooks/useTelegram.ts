"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

interface TelegramBackButton {
  isVisible?: boolean;
  show: () => void;
  hide: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
}

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  initData?: string;
  initDataUnsafe?: {
    user?: TelegramUser;
    start_param?: string;
  };
  colorScheme?: "light" | "dark";
  themeParams?: Record<string, string>;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  requestFullscreen?: () => void;
  exitFullscreen?: () => void;
  isFullscreen?: boolean;
  disableVerticalSwipes?: () => void;
  enableVerticalSwipes?: () => void;
  isVersionAtLeast?: (v: string) => boolean;
  platform?: string;
  isExpanded?: boolean;
  BackButton?: TelegramBackButton;
  openInvoice?: (
    url: string,
    callback?: (status: "paid" | "cancelled" | "failed" | "pending") => void
  ) => void;
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink?: (url: string) => void;
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

function applyFullscreen() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    tg.disableVerticalSwipes?.();
    // Fullscreen Mini App (Bot API 8.0+)
    if (typeof tg.requestFullscreen === "function") {
      try {
        tg.requestFullscreen();
      } catch {
        /* older clients */
      }
    }
    document.documentElement.classList.remove("tg-light");
    tg.setHeaderColor?.("#06060a");
    tg.setBackgroundColor?.("#06060a");
  } catch {
    /* ignore */
  }
}

export function useTelegram() {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [startParam, setStartParam] = useState<string | null>(null);
  const backHandlerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    applyFullscreen();
    const tg = window.Telegram?.WebApp;
    if (tg) {
      if (tg.initDataUnsafe?.user) {
        setUser(tg.initDataUnsafe.user);
      }
      if (tg.initDataUnsafe?.start_param) {
        setStartParam(tg.initDataUnsafe.start_param);
      }
    }
    setIsReady(true);

    // Re-apply on visibility (some clients reset)
    const onVis = () => {
      if (document.visibilityState === "visible") applyFullscreen();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const username =
    user?.username ||
    (user?.first_name
      ? user.first_name + (user.last_name ? " " + user.last_name : "")
      : null);

  const haptic = useCallback((style: "light" | "medium" | "heavy" = "light") => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
    } catch {
      /* ignore */
    }
  }, []);

  const hapticSuccess = useCallback(() => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
    } catch {
      /* ignore */
    }
  }, []);

  const hapticError = useCallback(() => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("error");
    } catch {
      /* ignore */
    }
  }, []);

  const openStarsInvoice = useCallback(
    (invoiceLink: string): Promise<"paid" | "cancelled" | "failed" | "pending"> => {
      return new Promise((resolve) => {
        const tg = window.Telegram?.WebApp;
        if (!tg?.openInvoice) {
          resolve("failed");
          return;
        }
        tg.openInvoice(invoiceLink, (status) => {
          resolve(status);
        });
      });
    },
    []
  );

  const openLink = useCallback((url: string) => {
    const tg = window.Telegram?.WebApp;
    if (tg?.openLink) {
      tg.openLink(url);
    } else {
      window.open(url, "_blank");
    }
  }, []);

  /** Show Telegram header back arrow; hides the default close (X) behavior when possible */
  const setBackButton = useCallback((handler: (() => void) | null) => {
    const bb = window.Telegram?.WebApp?.BackButton;
    if (!bb) {
      backHandlerRef.current = handler;
      return;
    }
    const prev = backHandlerRef.current;
    if (prev) {
      try {
        bb.offClick(prev);
      } catch {
        /* ignore */
      }
    }
    backHandlerRef.current = handler;
    if (handler) {
      try {
        bb.onClick(handler);
        bb.show();
      } catch {
        /* ignore */
      }
    } else {
      try {
        bb.hide();
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      const bb = window.Telegram?.WebApp?.BackButton;
      const h = backHandlerRef.current;
      if (bb && h) {
        try {
          bb.offClick(h);
          bb.hide();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  return {
    user,
    username,
    telegramId: user?.id ?? null,
    isReady,
    startParam,
    close: () => window.Telegram?.WebApp?.close(),
    haptic,
    hapticSuccess,
    hapticError,
    openStarsInvoice,
    openLink,
    setBackButton,
    initData: typeof window !== "undefined" ? window.Telegram?.WebApp?.initData : undefined,
  };
}
