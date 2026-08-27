"use client";

interface DepositModalProps {
  open: boolean;
  onClose: () => void;
  onDeposit: (amount: number) => void;
}

export function DepositModal({ open, onClose, onDeposit }: DepositModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-[#16161f] rounded-t-2xl p-5 slide-up border-t border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Deposit GRAM</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-white/50 mb-4">
          Demo mode — choose amount to add
        </p>
        <div className="flex gap-2">
          {[10, 50, 100].map((v) => (
            <button
              key={v}
              onClick={() => onDeposit(v)}
              className="flex-1 py-3 rounded-xl bg-white/5 text-sm font-medium hover:bg-white/10 transition"
            >
              +{v}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
