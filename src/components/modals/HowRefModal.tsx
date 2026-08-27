"use client";

interface HowRefModalProps {
  open: boolean;
  onClose: () => void;
  onCopy: () => void;
}

export function HowRefModal({ open, onClose, onCopy }: HowRefModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md glass-strong rounded-t-3xl p-5 slide-up border-t border-white/10 safe-bottom">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold tracking-tight">How referrals work</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-white/40 btn-press"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 mb-5">
          {[
            { n: "1", t: "Share your unique link" },
            { n: "2", t: "Friend opens the Mini App" },
            { n: "3", t: "You both get rewards" },
          ].map((s) => (
            <div key={s.n} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-300">
                {s.n}
              </div>
              <span className="text-sm text-white/70">{s.t}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            onCopy();
            onClose();
          }}
          className="w-full h-11 rounded-xl btn-primary text-sm btn-press"
        >
          Copy my link
        </button>
      </div>
    </div>
  );
}
