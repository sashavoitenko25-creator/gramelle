"use client";

import { useEffect, useMemo, useState } from "react";
import { Wheel } from "@/components/game/Wheel";
import { PlayerList } from "@/components/game/PlayerList";
import { TonIcon } from "@/components/ui/TonIcon";
import type { Player } from "@/lib/types";
import { formatGram, cn } from "@/lib/utils";
import { ROOMS, type RoomMode } from "@/lib/constants";

interface HighlightGame {
  rollId: number;
  winner: string;
  pot: number;
  chance: number;
  photoUrl?: string | null;
}

interface PvpScreenProps {
  players: Player[];
  balance: number;
  online: number;
  rollId: number;
  isSpinning: boolean;
  spinDegrees: number;
  status: string;
  mode: RoomMode;
  onModeChange: (m: RoomMode) => void;
  serverSeedHash?: string | null;
  countdown?: number | null;
  countdownTotalSec?: number;
  countdownEndsAt?: string | null;
  onOpenBet: () => void;
  onOpenDeposit: () => void;
  onOpenHistory: () => void;
  onOpenVerify?: () => void;
  onVerifyRoll?: (rollId: number) => void;
  onOpenHistoryFilter?: (filter: "all" | "top") => void;
  myPhotoUrl?: string | null;
}


function Avatar({
  name,
  photoUrl,
  size = 24,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
}) {
  const letter = (name || "?").replace(/^@/, "").charAt(0).toUpperCase();
  return (
    <div
      className="rounded-full overflow-hidden bg-white/10 border border-white/15 flex items-center justify-center shrink-0 text-white/80 font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        letter
      )}
    </div>
  );
}

/** Approximate cubic-bezier(0.12, 0.85, 0.15, 1) progress 0..1 */
function spinEase(t: number) {
  const x = Math.min(1, Math.max(0, t));
  // smooth ease-out matching wheel CSS
  return 1 - Math.pow(1 - x, 3.4);
}

function playerUnderPointer(
  list: Player[],
  rotationDeg: number
): Player | null {
  if (!list.length) return null;
  const total = list.reduce((s, p) => s + p.amount, 0);
  if (total <= 0) return null;
  // Pointer at top; wheel rotated by rotationDeg clockwise
  let angle = (360 - (rotationDeg % 360) + 360) % 360;
  let acc = 0;
  for (const p of list) {
    const sweep = (p.amount / total) * 360;
    if (angle >= acc && angle < acc + sweep) return p;
    acc += sweep;
  }
  return list[list.length - 1];
}

export function PvpScreen({
  players,
  balance,
  online,
  rollId,
  isSpinning,
  spinDegrees,
  status,
  mode,
  onModeChange,
  serverSeedHash,
  countdown = null,
  countdownTotalSec = 20,
  countdownEndsAt = null,
  onOpenBet,
  onOpenDeposit,
  onOpenHistory,
  onOpenVerify,
  onVerifyRoll,
  onOpenHistoryFilter,
  myPhotoUrl,
}: PvpScreenProps) {
  const total = players.reduce((s, p) => s + p.amount, 0);
  const room = ROOMS[mode];

  const [lastGame, setLastGame] = useState<HighlightGame | null>(null);
  const [topGame, setTopGame] = useState<HighlightGame | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/rounds/recent?limit=20`);
        const data = await res.json();
        const items = (data.items || []) as Array<{
          rollId: number;
          winner: string;
          pot: number;
          chance: number;
          photoUrl?: string | null;
        }>;
        if (!alive || !items.length) return;
        setLastGame({
          rollId: items[0].rollId,
          winner: items[0].winner,
          pot: items[0].pot,
          chance: items[0].chance,
          photoUrl: (items[0] as { photoUrl?: string }).photoUrl,
        });
        const top = [...items].sort((a, b) => b.pot - a.pot)[0];
        setTopGame({
          rollId: top.rollId,
          winner: top.winner,
          pot: top.pot,
          chance: top.chance,
          photoUrl: (top as { photoUrl?: string }).photoUrl,
        });
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [rollId]);

  const playersWithPhoto = players.map((p) =>
    p.isMe && myPhotoUrl && !p.photoUrl ? { ...p, photoUrl: myPhotoUrl } : p
  );

  const [pointedPlayer, setPointedPlayer] = useState<Player | null>(null);

  const playersKey = players
    .map((p) => `${p.id}:${p.amount}:${p.photoUrl || ""}`)
    .join("|");

  useEffect(() => {
    if (!isSpinning || spinDegrees <= 0) {
      setPointedPlayer(null);
      return;
    }
    const list = players.map((p) =>
      p.isMe && myPhotoUrl && !p.photoUrl ? { ...p, photoUrl: myPhotoUrl } : p
    );
    const duration = 4200;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const rot = spinDegrees * spinEase(t);
      setPointedPlayer(playerUnderPointer(list, rot));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setPointedPlayer(playerUnderPointer(list, spinDegrees));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpinning, spinDegrees, playersKey, myPhotoUrl]);

  const countdownProgress =
    countdown != null && countdown > 0 && countdownTotalSec > 0
      ? 1 - countdown / countdownTotalSec
      : null;

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-500/35 to-cyan-500/25 border border-white/10 flex items-center justify-center shadow-[0_0_24px_rgba(139,92,246,0.2)]">
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-cyan-300"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 3v18M3 12h18" opacity="0.45" />
            </svg>
          </div>
          <div>
            <div className="text-[15px] font-semibold tracking-tight leading-tight">
              Gramelle
            </div>
            <div className="text-[10px] text-white/40 flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              {players.length > 0
                ? `${players.length} online`
                : "online"}
            </div>
          </div>
        </div>
        <div className="w-9" />
      </div>

      {/* Last / Top game */}
      <div className="mx-4 mb-2 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => onOpenHistoryFilter?.("all")}
          className="rounded-2xl bg-white/[0.03] border border-white/[0.07] px-2 py-1.5 text-left hover:border-white/12 transition btn-press overflow-hidden"
        >
          <div className="text-[8px] uppercase tracking-wider text-white/30 mb-0.5">
            Last game
          </div>
          {lastGame ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <Avatar name={lastGame.winner} photoUrl={lastGame.photoUrl} size={20} />
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="text-[11px] font-medium text-white/80 truncate leading-tight">
                  @{lastGame.winner}
                </div>
                <div className="text-[10px] text-emerald-300/90 tabular-nums mt-0.5 truncate">
                  +{formatGram(lastGame.pot)} GRAM
                  <span className="text-white/25 ml-1">{lastGame.chance}%</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-white/25">—</div>
          )}
        </button>
        <button
          type="button"
          onClick={() => onOpenHistoryFilter?.("top")}
          className="rounded-2xl bg-white/[0.03] border border-white/[0.07] px-3 py-2.5 text-left hover:border-amber-500/25 transition btn-press"
        >
          <div className="text-[8px] uppercase tracking-wider text-white/30 mb-0.5">
            Top game
          </div>
          {topGame ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <Avatar name={topGame.winner} photoUrl={topGame.photoUrl} size={20} />
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="text-[11px] font-medium text-white/80 truncate leading-tight">
                  @{topGame.winner}
                </div>
                <div className="text-[10px] text-amber-300/90 tabular-nums mt-0.5 truncate">
                  +{formatGram(topGame.pot)} GRAM
                  <span className="text-white/25 ml-1">{topGame.chance}%</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-white/25">—</div>
          )}
        </button>
      </div>

      {/* Rooms */}
      <div className="mx-4 mb-3 flex gap-1.5 p-1 rounded-2xl bg-black/35 border border-white/[0.06]">
        {(Object.keys(ROOMS) as RoomMode[]).map((id) => {
          const r = ROOMS[id];
          const active = mode === id;
          return (
            <button
              key={id}
              onClick={() => onModeChange(id)}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-xs font-semibold transition btn-press",
                active
                  ? id === "high"
                    ? "bg-amber-500/20 text-amber-100 border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.12)]"
                    : "bg-white/10 text-white border border-white/12"
                  : "text-white/40 hover:text-white/60 border border-transparent"
              )}
            >
              {r.name}
              <span className="block text-[9px] font-normal opacity-60 mt-0.5">
                from {r.minBet} GRAM
              </span>
            </button>
          );
        })}
      </div>

      {/* History (left) + Bank/pointer (center) */}
      <div className="mx-4 mt-1 mb-3 grid grid-cols-[40px_1fr_40px] items-center gap-2">
        <button
          type="button"
          onClick={onOpenHistory}
          aria-label="History"
          className="w-10 h-10 rounded-full glass border border-white/[0.09] flex items-center justify-center text-white/50 hover:text-white/80 transition btn-press"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </button>
        <div className="flex justify-center min-w-0">
          <div className="px-4 py-2 rounded-full glass border border-white/[0.09] flex items-center gap-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.25)] max-w-full">
            {pointedPlayer ? (
              <>
                <Avatar
                  name={pointedPlayer.name}
                  photoUrl={pointedPlayer.photoUrl}
                  size={28}
                />
                <span className="text-[14px] font-semibold truncate max-w-[140px]">
                  @{pointedPlayer.name}
                </span>
              </>
            ) : (
              <>
                <span className="text-[10px] text-white/40 uppercase tracking-[0.14em] font-medium">
                  Bank
                </span>
                <span className="text-[17px] font-semibold text-gradient-cyan tabular-nums">
                  {formatGram(total)}
                </span>
                <span className="text-[11px] text-white/35">GRAM</span>
              </>
            )}
          </div>
        </div>
        <div aria-hidden className="w-10 h-10" />
      </div>

      <Wheel
        players={playersWithPhoto}
        isSpinning={isSpinning}
        spinDegrees={spinDegrees}
        status={status}
        countdownProgress={countdownProgress}
        countdownSec={countdown != null && countdown > 0 ? countdown : null}
        countdownEndsAt={countdownEndsAt}
        countdownTotalSec={countdownTotalSec}
      />

      {serverSeedHash && (
        <div className="mx-4 mb-2 flex items-center justify-center gap-1.5">
          <span className="text-[9px] text-white/40 uppercase tracking-wider font-medium">
            Hash
          </span>
          <span className="text-[9px] text-white/30 font-mono tracking-tight">
            {serverSeedHash.slice(0, 8)}…{serverSeedHash.slice(-6)}
          </span>
          <button
            type="button"
            aria-label="Copy hash"
            onClick={() => {
              try {
                void navigator.clipboard.writeText(serverSeedHash);
              } catch {}
            }}
            className="h-6 w-6 rounded-md border border-white/10 bg-white/[0.04] flex items-center justify-center text-white/40 hover:text-white/70"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15V5a2 2 0 012-2h10" />
            </svg>
          </button>
        </div>
      )}

      {/* Balance card */}
      <div className="mx-4 mb-4">
        <div className="flex items-center justify-between bg-white/[0.035] rounded-2xl px-4 py-3.5 border border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0098EA]/15 border border-[#0098EA]/30 flex items-center justify-center shadow-[0_0_16px_rgba(0,152,234,0.15)]">
              <TonIcon size={18} />
            </div>
            <div>
              <div className="text-[10px] text-white/35 uppercase tracking-wider">
                Balance
              </div>
              <div className="text-[15px] font-semibold tabular-nums flex items-baseline gap-1.5 mt-0.5">
                {formatGram(balance)}
                <span className="text-[10px] text-white/35 font-medium">
                  GRAM
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onOpenDeposit}
            className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-white/65 hover:bg-white/10 transition btn-press"
            aria-label="Deposit"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      {/* CTA */}
      <div className="mx-4 mb-5">
        <button
          onClick={onOpenBet}
          disabled={isSpinning}
          className="w-full py-3.5 rounded-2xl btn-primary text-[14px] tracking-wide btn-press disabled:opacity-40"
        >
          Place Bet · {room.minBet}–{room.maxBet}
        </button>
        <p className="text-center text-[10px] text-white/25 mt-2.5">
          Up to {room.maxPlayers} players · {room.countdownSec}s
        </p>
      </div>

      <div className="mx-4 mb-2 flex items-center justify-between">
        <span className="text-[11px] text-white/35 uppercase tracking-[0.12em] font-medium">
          Players · {players.length}
        </span>
        <span className="text-[11px] text-white/35 uppercase tracking-[0.12em] font-medium tabular-nums">
          SPIN #{rollId}
        </span>
      </div>

      <PlayerList players={playersWithPhoto} total={total} />
    </div>
  );
}
