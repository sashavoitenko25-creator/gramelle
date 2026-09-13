"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { rpsState, type RpsChoice, type RpsPublicRoom } from "@/lib/rpsApi";
import { formatGram } from "@/lib/utils";

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function resolveRps(
  a: RpsChoice,
  b: RpsChoice
): "a" | "b" | "draw" {
  if (a === b) return "draw";
  if (
    (a === "rock" && b === "scissors") ||
    (a === "scissors" && b === "paper") ||
    (a === "paper" && b === "rock")
  )
    return "a";
  return "b";
}

const CHOICE_LABEL: Record<RpsChoice, string> = {
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
};

interface FairnessScreenProps {
  onBack: () => void;
}

export function FairnessScreen({ onBack }: FairnessScreenProps) {
  const { t, lang } = useI18n();
  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<RpsPublicRoom | null>(null);
  const [checks, setChecks] = useState<{
    seedOk: boolean | null;
    commitOk: boolean | null;
    winnerOk: boolean | null;
  } | null>(null);

  // Manual fields (optional override / offline)
  const [manualSeed, setManualSeed] = useState("");
  const [manualSeedHash, setManualSeedHash] = useState("");
  const [manualChoice, setManualChoice] = useState<RpsChoice | "">("");
  const [manualNonce, setManualNonce] = useState("");
  const [manualChoiceHash, setManualChoiceHash] = useState("");
  const [manualJoiner, setManualJoiner] = useState<RpsChoice | "">("");
  const [showManual, setShowManual] = useState(false);

  const runChecks = async (data: {
    serverSeed: string | null;
    serverSeedHash: string;
    creatorChoice: RpsChoice | null;
    creatorChoiceNonce: string | null;
    creatorChoiceHash: string;
    joinerChoice: RpsChoice | null;
    winnerTelegramId: number | null;
    creatorTelegramId: number;
    joinerTelegramId: number | null;
  }) => {
    let seedOk: boolean | null = null;
    let commitOk: boolean | null = null;
    let winnerOk: boolean | null = null;

    if (data.serverSeed && data.serverSeedHash) {
      const h = await sha256Hex(data.serverSeed);
      seedOk = h === data.serverSeedHash.toLowerCase();
    }

    if (
      data.creatorChoice &&
      data.creatorChoiceNonce &&
      data.creatorChoiceHash
    ) {
      const h = await sha256Hex(
        `${data.creatorChoice}:${data.creatorChoiceNonce}`
      );
      commitOk = h === data.creatorChoiceHash.toLowerCase();
    }

    if (data.creatorChoice && data.joinerChoice) {
      const outcome = resolveRps(data.creatorChoice, data.joinerChoice);
      if (outcome === "draw") {
        winnerOk = data.winnerTelegramId == null;
      } else if (outcome === "a") {
        winnerOk = data.winnerTelegramId === data.creatorTelegramId;
      } else {
        winnerOk =
          data.joinerTelegramId != null &&
          data.winnerTelegramId === data.joinerTelegramId;
      }
    }

    setChecks({ seedOk, commitOk, winnerOk });
  };

  const loadRoom = async () => {
    const id = roomId.trim();
    if (!id) {
      setError(lang === "ru" ? "Введите ID комнаты" : "Enter room ID");
      return;
    }
    setLoading(true);
    setError(null);
    setChecks(null);
    setRoom(null);
    try {
      const res = await rpsState(id);
      const r = res.room;
      setRoom(r);
      setManualSeed(r.serverSeed || "");
      setManualSeedHash(r.serverSeedHash || "");
      setManualChoice(r.creatorChoice || "");
      setManualNonce(r.creatorChoiceNonce || "");
      setManualChoiceHash(r.creatorChoiceHash || "");
      setManualJoiner(r.joinerChoice || "");
      await runChecks({
        serverSeed: r.serverSeed,
        serverSeedHash: r.serverSeedHash,
        creatorChoice: r.creatorChoice,
        creatorChoiceNonce: r.creatorChoiceNonce,
        creatorChoiceHash: r.creatorChoiceHash,
        joinerChoice: r.joinerChoice,
        winnerTelegramId: r.winnerTelegramId,
        creatorTelegramId: r.creatorTelegramId,
        joinerTelegramId: r.joinerTelegramId,
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : lang === "ru"
            ? "Комната не найдена"
            : "Room not found"
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyManual = async () => {
    setLoading(true);
    setError(null);
    try {
      await runChecks({
        serverSeed: manualSeed.trim() || null,
        serverSeedHash: manualSeedHash.trim(),
        creatorChoice: (manualChoice || null) as RpsChoice | null,
        creatorChoiceNonce: manualNonce.trim() || null,
        creatorChoiceHash: manualChoiceHash.trim(),
        joinerChoice: (manualJoiner || null) as RpsChoice | null,
        winnerTelegramId: room?.winnerTelegramId ?? null,
        creatorTelegramId: room?.creatorTelegramId ?? 0,
        joinerTelegramId: room?.joinerTelegramId ?? null,
      });
    } finally {
      setLoading(false);
    }
  };

  const CheckRow = ({
    label,
    ok,
  }: {
    label: string;
    ok: boolean | null;
  }) => (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
      <span className="text-[13px] text-white/60">{label}</span>
      {ok === null ? (
        <span className="text-[12px] text-white/30">—</span>
      ) : ok ? (
        <span className="text-[12px] font-semibold text-emerald-400">✓ OK</span>
      ) : (
        <span className="text-[12px] font-semibold text-rose-400">✗ FAIL</span>
      )}
    </div>
  );

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      <div className="px-4 pt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-white/70 btn-press"
        >
          ←
        </button>
        <div>
          <div className="text-base font-semibold">
            {lang === "ru" ? "Проверка честности" : "Fairness check"}
          </div>
          <div className="text-[11px] text-white/35">
            {lang === "ru"
              ? "Commit–reveal · SHA-256"
              : "Commit–reveal · SHA-256"}
          </div>
        </div>
      </div>

      <div className="px-4 mt-5 space-y-4">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
          <p className="text-[12px] text-white/45 leading-relaxed mb-3">
            {lang === "ru"
              ? "Вставьте ID комнаты из истории или результата. Система сверит seed, commit создателя и победителя."
              : "Paste a room ID from history or result. We verify the seed, creator commit, and winner."}
          </p>
          <label className="text-[10px] uppercase tracking-widest text-white/30 mb-1.5 block">
            Room ID
          </label>
          <div className="flex gap-2">
            <input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="uuid…"
              className="flex-1 h-11 rounded-xl bg-black/30 border border-white/10 px-3 text-sm font-mono outline-none focus:border-cyan-500/40"
            />
            <button
              type="button"
              disabled={loading}
              onClick={loadRoom}
              className="h-11 px-4 rounded-xl btn-primary text-sm font-medium btn-press disabled:opacity-50"
            >
              {loading
                ? "…"
                : lang === "ru"
                  ? "Проверить"
                  : "Check"}
            </button>
          </div>
          {error && (
            <p className="text-[12px] text-rose-400 mt-2">{error}</p>
          )}
        </div>

        {room && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
            <div className="text-[11px] uppercase tracking-widest text-white/30">
              {lang === "ru" ? "Игра" : "Game"}
            </div>
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <div>
                <div className="text-[10px] text-white/30">Status</div>
                <div className="text-white/80 font-medium">{room.status}</div>
              </div>
              <div>
                <div className="text-[10px] text-white/30">
                  {lang === "ru" ? "Ставка" : "Stake"}
                </div>
                <div className="text-white/80 font-medium tabular-nums">
                  {formatGram(room.amount)} GRAM
                </div>
              </div>
              <div>
                <div className="text-[10px] text-white/30">Creator</div>
                <div className="text-white/80 truncate">
                  @{room.creatorUsername}{" "}
                  {room.creatorChoice
                    ? CHOICE_LABEL[room.creatorChoice]
                    : ""}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-white/30">Joiner</div>
                <div className="text-white/80 truncate">
                  {room.joinerUsername
                    ? `@${room.joinerUsername}`
                    : "—"}{" "}
                  {room.joinerChoice
                    ? CHOICE_LABEL[room.joinerChoice]
                    : ""}
                </div>
              </div>
            </div>
            {room.winnerTelegramId != null ? (
              <div className="text-[12px] text-cyan-300/90">
                {lang === "ru" ? "Победитель ID:" : "Winner ID:"}{" "}
                {room.winnerTelegramId}
              </div>
            ) : room.status === "finished" ? (
              <div className="text-[12px] text-white/45">
                {lang === "ru" ? "Ничья" : "Draw"}
              </div>
            ) : null}
          </div>
        )}

        {checks && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-1">
            <CheckRow
              label={
                lang === "ru"
                  ? "SHA-256(server seed) = hash"
                  : "SHA-256(server seed) = hash"
              }
              ok={checks.seedOk}
            />
            <CheckRow
              label={
                lang === "ru"
                  ? "SHA-256(choice:nonce) = commit"
                  : "SHA-256(choice:nonce) = commit"
              }
              ok={checks.commitOk}
            />
            <CheckRow
              label={
                lang === "ru"
                  ? "Победитель совпадает с правилами"
                  : "Winner matches RPS rules"
              }
              ok={checks.winnerOk}
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          className="text-[12px] text-cyan-300/80 hover:text-cyan-200 transition"
        >
          {showManual
            ? lang === "ru"
              ? "Скрыть ручной ввод"
              : "Hide manual fields"
            : lang === "ru"
              ? "Ручной ввод данных"
              : "Manual data entry"}
        </button>

        {showManual && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
            {(
              [
                ["Server seed", manualSeed, setManualSeed],
                ["Server seed hash", manualSeedHash, setManualSeedHash],
                ["Creator choice hash", manualChoiceHash, setManualChoiceHash],
                ["Creator nonce", manualNonce, setManualNonce],
              ] as const
            ).map(([label, val, set]) => (
              <div key={label}>
                <label className="text-[10px] uppercase tracking-widest text-white/30 mb-1 block">
                  {label}
                </label>
                <input
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  className="w-full h-10 rounded-xl bg-black/30 border border-white/10 px-3 text-[12px] font-mono outline-none focus:border-cyan-500/40"
                />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-white/30 mb-1 block">
                  Creator choice
                </label>
                <select
                  value={manualChoice}
                  onChange={(e) =>
                    setManualChoice(e.target.value as RpsChoice | "")
                  }
                  className="w-full h-10 rounded-xl bg-black/30 border border-white/10 px-2 text-sm outline-none"
                >
                  <option value="">—</option>
                  <option value="rock">rock</option>
                  <option value="paper">paper</option>
                  <option value="scissors">scissors</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-white/30 mb-1 block">
                  Joiner choice
                </label>
                <select
                  value={manualJoiner}
                  onChange={(e) =>
                    setManualJoiner(e.target.value as RpsChoice | "")
                  }
                  className="w-full h-10 rounded-xl bg-black/30 border border-white/10 px-2 text-sm outline-none"
                >
                  <option value="">—</option>
                  <option value="rock">rock</option>
                  <option value="paper">paper</option>
                  <option value="scissors">scissors</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={verifyManual}
              className="w-full h-11 rounded-xl btn-primary text-sm font-medium btn-press disabled:opacity-50"
            >
              {lang === "ru" ? "Пересчитать" : "Recompute"}
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-white/[0.04] px-3.5 py-3 text-[11px] text-white/30 leading-relaxed">
          {lang === "ru"
            ? "До начала игры публикуется только хеш выбора создателя и хеш server seed. После матча раскрываются seed, choice и nonce — любой может пересчитать SHA-256 и убедиться, что выбор не менялся."
            : "Before the match only the creator choice hash and server seed hash are public. After the match, seed, choice and nonce are revealed so anyone can recompute SHA-256 and confirm the choice was not changed."}
        </div>
      </div>
    </div>
  );
}
