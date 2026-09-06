"use client";

/**
 * Tasks hub — placeholder for future missions
 * (e.g. subscribe to channel → 0.125 GRAM).
 */
export function TasksScreen({ onBack }: { onBack?: () => void }) {
  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      <div className="flex items-center justify-between px-4 pt-3 pb-3">
        {onBack ? (
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-white/50 btn-press"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        ) : (
          <div className="w-9" />
        )}
        <h2 className="text-base font-semibold tracking-tight">Tasks</h2>
        <div className="w-9" />
      </div>

      <div className="mx-4 mt-6 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 text-center">
        <div className="text-4xl mb-3">🎯</div>
        <h3 className="text-lg font-semibold mb-2">Coming soon</h3>
        <p className="text-sm text-white/45 leading-relaxed">
          Complete simple tasks — subscribe to a channel, invite friends, play
          rounds — and earn GRAM rewards.
        </p>
      </div>

      <div className="mx-4 mt-4 space-y-2 opacity-50 pointer-events-none">
        {[
          { title: "Subscribe to channel", reward: "0.125 GRAM" },
          { title: "Play 5 rounds", reward: "0.25 GRAM" },
          { title: "Invite 1 friend", reward: "0.125 GRAM" },
        ].map((t) => (
          <div
            key={t.title}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 flex items-center justify-between"
          >
            <div>
              <div className="text-sm text-white/70">{t.title}</div>
              <div className="text-[11px] text-white/30 mt-0.5">Locked</div>
            </div>
            <div className="text-xs font-medium text-cyan-300/60 tabular-nums">
              +{t.reward}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
