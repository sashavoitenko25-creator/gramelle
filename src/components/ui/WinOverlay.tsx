"use client";

interface WinOverlayProps {
  open: boolean;
  isWin: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
}

export function WinOverlay({
  open,
  isWin,
  title,
  subtitle,
  onClose,
}: WinOverlayProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center modal-backdrop px-4"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-sm rounded-3xl p-6 border text-center slide-up ${
          isWin
            ? "bg-gradient-to-b from-emerald-500/20 to-[#0c0c14] border-emerald-400/30 shadow-[0_0_60px_rgba(52,211,153,0.15)]"
            : "bg-gradient-to-b from-white/10 to-[#0c0c14] border-white/10"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`mx-auto mb-4 w-16 h-16 rounded-2xl flex items-center justify-center text-3xl ${
            isWin ? "bg-emerald-400/15 border border-emerald-400/30" : "bg-white/5 border border-white/10"
          }`}
        >
          {isWin ? "🏆" : "🎯"}
        </div>
        <h3 className="text-xl font-semibold tracking-tight mb-1">{title}</h3>
        <p className="text-sm text-white/55 mb-5">{subtitle}</p>
        <button
          onClick={onClose}
          className="w-full h-11 rounded-2xl btn-primary text-sm btn-press"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
