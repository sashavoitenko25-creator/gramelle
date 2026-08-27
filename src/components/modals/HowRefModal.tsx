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
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm bg-[#16161f] rounded-2xl p-5 slide-up border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">How Referrals Work</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center justify-center gap-3 mb-5 py-3 bg-[#0a0a0f] rounded-xl">
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-purple-500/30 flex items-center justify-center mx-auto mb-1 text-lg">
              👥
            </div>
            <div className="text-[10px] text-white/50">Invite friends</div>
          </div>
          <span className="text-white/30">→</span>
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-cyan-500/30 flex items-center justify-center mx-auto mb-1 text-lg">
              💎
            </div>
            <div className="text-[10px] text-white/50">Earn GRAM</div>
          </div>
        </div>

        <ol className="space-y-3 text-sm text-white/70 mb-5">
          <li>
            <strong className="text-white">1.</strong> Copy or share your personal link
          </li>
          <li>
            <strong className="text-white">2.</strong> Friends start playing via your link
          </li>
          <li>
            <strong className="text-white">3.</strong> Earn 10% of their fees — credited to
            your balance
          </li>
        </ol>

        <div className="flex gap-2">
          <button
            onClick={() => {
              onCopy();
              onClose();
            }}
            className="flex-1 h-11 rounded-xl bg-white/10 text-sm font-medium"
          >
            Copy link
          </button>
          <button
            onClick={() => {
              onCopy();
              onClose();
            }}
            className="flex-1 h-11 rounded-xl bg-white text-black text-sm font-semibold"
          >
            Invite
          </button>
        </div>
      </div>
    </div>
  );
}
