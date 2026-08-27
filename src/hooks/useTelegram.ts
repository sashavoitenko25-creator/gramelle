"use client";

import { useEffect, useState, useCallback } from "react";

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
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
  platform?: string;
  isExpanded?: boolean;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export function useTelegram() {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [startParam, setStartParam] = useState<string | null>(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      try {
        tg.ready();
        tg.expand();
        const scheme = tg.colorScheme || "dark";
        document.documentElement.classList.toggle("tg-light", scheme === "light");
        if (scheme === "dark") {
          tg.setHeaderColor?.("#07070b");
          tg.setBackgroundColor?.("#07070b");
        }
      } catch {
        // ignore
      }
      if (tg.initDataUnsafe?.user) {
        setUser(tg.initDataUnsafe.user);
      }
      if (tg.initDataUnsafe?.start_param) {
        setStartParam(tg.initDataUnsafe.start_param);
      }
    }
    setIsReady(true);
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
      // ignore
    }
  }, []);

  const hapticSuccess = useCallback(() => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
    } catch {
      // ignore
    }
  }, []);

  const hapticError = useCallback(() => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("error");
    } catch {
      // ignore
    }
  }, []);

  /** Open Telegram Stars invoice. Returns final status. */
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

  /** Open external / TON wallet link inside Telegram */
  const openLink = useCallback((url: string) => {
    const tg = window.Telegram?.WebApp;
    if (tg?.openLink) {
      tg.openLink(url);
    } else {
      window.open(url, "_blank");
    }
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
    initData: typeof window !== "undefined" ? window.Telegram?.WebApp?.initData : undefined,
  };
}
