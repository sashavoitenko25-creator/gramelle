"use client";

import { SUPPORT_URL } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/context";
import { useTelegram } from "@/hooks/useTelegram";

export function MaintenanceScreen() {
  const { lang } = useI18n();
  const { openLink } = useTelegram();
  const isRu = lang === "ru";

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center px-6 safe-top safe-bottom">
      {/* soft glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[280px] h-[280px] rounded-full bg-cyan-500/15 blur-[80px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[200px] h-[200px] rounded-full bg-violet-500/10 blur-[70px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm text-center">
        <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-violet-500/20 border border-white/10 flex items-center justify-center shadow-[0_0_40px_rgba(34,211,238,0.15)]">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="text-cyan-300"
          >
            <path
              d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="text-[22px] font-bold tracking-tight text-white mb-2">
          {isRu ? "Обновляем Gramelle" : "Updating Gramelle"}
        </h1>
        <p className="text-[14px] text-white/50 leading-relaxed mb-8">
          {isRu
            ? "Сейчас идут технические работы. Зайдите чуть позже — скоро всё снова будет доступно."
            : "We're performing maintenance. Please check back soon — everything will be back shortly."}
        </p>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 mb-6">
          <div className="flex items-center justify-center gap-2 text-[12px] text-white/40">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
            </span>
            {isRu ? "Технические работы" : "Maintenance in progress"}
          </div>
        </div>

        <button
          type="button"
          onClick={() => openLink(SUPPORT_URL)}
          className="text-[13px] text-cyan-300/90 hover:text-cyan-200 transition"
        >
          {isRu ? "Поддержка" : "Support"}:{" "}
          {SUPPORT_URL.replace("https://t.me/", "@")}
        </button>
      </div>
    </div>
  );
}
