"use client";

interface WinOverlayProps {
  open: boolean;
  isWin: boolean;
  title: string;
  subtitle: string;
  winnerName?: string;
  photoUrl?: string | null;
  onClose: () => void;
}

export function WinOverlay({
  open,
  isWin,
  title,
  subtitle,
  winnerName,
  photoUrl,
  onClose,
}: WinOverlayProps) {
  if (!open) return null;

  const letter = (winnerName || title || "?")
    .replace(/^@/, "")
    .charAt(0)
    .toUpperCase();

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-5 modal-backdrop"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-sm overflow-hidden rounded-[28px] border slide-up ${
          isWin
            ? "border-emerald-400/25 bg-gradient-to-b from-emerald-500/15 via-[#0c0c14] to-[#08080e] shadow-[0_0_80px_rgba(52,211,153,0.18)]"
            : "border-white/10 bg-gradient-to-b from-violet-500/12 via-[#0c0c14] to-[#08080e] shadow-[0_0_60px_rgba(139,92,246,0.12)]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full blur-3xl ${
            isWin ? "bg-emerald-400/25" : "bg-violet-400/20"
          }`}
        />

        <div className="relative px-6 pt-8 pb-6 text-center">
          <p
            className={`text-[10px] uppercase tracking-[0.2em] font-medium mb-5 ${
              isWin ? "text-emerald-300/70" : "text-white/35"
            }`}
          >
            {isWin ? "Victory" : "Round result"}
          </p>

          <div className="relative mx-auto mb-5 h-[88px] w-[88px]">
            <div
              className={`absolute inset-0 rounded-full blur-md opacity-70 ${
                isWin
                  ? "bg-gradient-to-br from-emerald-400/40 to-cyan-400/30"
                  : "bg-gradient-to-br from-violet-400/35 to-cyan-400/25"
              }`}
            />
            <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[#12121c]">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-3xl font-semibold text-white/85">
                  {letter}
                </span>
              )}
            </div>
          </div>

          <h3 className="text-xl font-semibold tracking-tight text-white mb-1.5">
            {title}
          </h3>
          <p
            className={`text-[15px] font-medium tabular-nums mb-6 ${
              isWin ? "text-emerald-300" : "text-cyan-300/90"
            }`}
          >
            {subtitle}
          </p>

          <button
            type="button"
            onClick={onClose}
            className="w-full h-12 rounded-2xl btn-primary text-sm font-semibold btn-press"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
