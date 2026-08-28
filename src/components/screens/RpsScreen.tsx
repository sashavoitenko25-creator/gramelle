"use client";

interface RpsScreenProps {
  onBack: () => void;
}

export function RpsScreen({ onBack }: RpsScreenProps) {
  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="w-10 h-10 rounded-full glass border border-white/[0.09] flex items-center justify-center text-white/55 hover:text-white/90 transition btn-press"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div>
          <div className="text-[16px] font-semibold tracking-tight">
            Rock · Paper · Scissors
          </div>
          <div className="text-[11px] text-white/40 mt-0.5">
            1v1 PvP · Coming soon
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-8">
        {/* Triple icon cluster */}
        <div className="relative mb-10">
          {/* Glow behind */}
          <div className="absolute inset-0 -m-8 rounded-full bg-fuchsia-500/15 blur-3xl" />
          <div className="absolute inset-0 -m-4 rounded-full bg-violet-500/10 blur-2xl" />

          <div className="relative flex items-center gap-3">
            {/* Rock */}
            <div className="w-[72px] h-[72px] rounded-3xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.12] flex items-center justify-center shadow-[0_12px_40px_rgba(0,0,0,0.4)] backdrop-blur-sm">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-white/85">
                <path
                  d="M8 10.5c0-1.5 1-2.5 2.5-2.5h1c.8 0 1.5.4 2 1 .4-.6 1.1-1 2-1h1c1.5 0 2.5 1 2.5 2.5V15c0 2.2-1.8 4-4 4h-3c-2.2 0-4-1.8-4-4v-4.5z"
                  fill="currentColor"
                  opacity="0.9"
                />
                <path
                  d="M10 8V6.5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5V8"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  opacity="0.65"
                />
              </svg>
            </div>

            {/* Paper */}
            <div className="w-[72px] h-[72px] rounded-3xl bg-gradient-to-br from-fuchsia-500/20 to-pink-500/10 border border-fuchsia-400/25 flex items-center justify-center shadow-[0_12px_40px_rgba(236,72,153,0.2)] backdrop-blur-sm -mt-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-fuchsia-200">
                <rect
                  x="6"
                  y="3"
                  width="12"
                  height="18"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M9 8h6M9 12h6M9 16h4"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  opacity="0.75"
                />
              </svg>
            </div>

            {/* Scissors */}
            <div className="w-[72px] h-[72px] rounded-3xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.12] flex items-center justify-center shadow-[0_12px_40px_rgba(0,0,0,0.4)] backdrop-blur-sm">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-white/85">
                <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="6" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M8.5 7.5L20 18M8.5 16.5L20 6"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Text */}
        <div className="text-center max-w-[280px]">
          <h2 className="text-[20px] font-semibold text-white tracking-tight mb-2">
            Under construction
          </h2>
          <p className="text-[14px] text-white/45 leading-relaxed">
            Full 1v1 matchmaking, best-of-three rounds and GRAM stakes are on the way.
          </p>
        </div>

        {/* Decorative line */}
        <div className="mt-10 flex items-center gap-3 opacity-40">
          <div className="h-px w-10 bg-gradient-to-r from-transparent to-white/40" />
          <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
          <div className="h-px w-10 bg-gradient-to-l from-transparent to-white/40" />
        </div>
      </div>
    </div>
  );
}
