"use client";

import { useState } from "react";

// Mock data — later will come from backend / WebSocket
const MOCK_PLAYERS = [
  {
    id: 1,
    username: "gxwerr",
    avatar: null,
    amount: 35.4,
    chance: 100,
    color: "#a855f7",
  },
];

const MOCK_STATS = {
  online: 66,
  totalBank: 35.4,
  rollId: 624789,
  lastGame: {
    username: "nikipopus",
    amount: 12,
    chance: 53,
  },
  topGame: {
    username: "lqpdwasd",
    amount: 52833,
    chance: 99,
  },
};

export default function Home() {
  const [balance] = useState(3.49);
  const [players] = useState(MOCK_PLAYERS);
  const totalPlayers = players.length;

  return (
    <div className="relative min-h-screen flex flex-col starfield overflow-hidden">
      {/* Top status bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>{MOCK_STATS.online} online</span>
        </div>
        <div className="flex gap-2">
          <button className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:bg-white/10 transition">
            ⋯
          </button>
          <button className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:bg-white/10 transition">
            ✕
          </button>
        </div>
      </div>

      {/* Tournament banner */}
      <div className="mx-4 mb-3">
        <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-3 py-2.5 shadow-lg shadow-emerald-500/20">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏆</span>
            <span className="text-sm font-semibold text-white">
              USDT PvP Tournament
            </span>
          </div>
          <span className="text-white/80 text-lg">›</span>
        </div>
      </div>

      {/* Last / Top game cards */}
      <div className="mx-4 mb-3 flex gap-2">
        <div className="flex-1 rounded-xl bg-[#1a1a24] border border-white/5 px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[10px]">
              N
            </div>
            <span className="text-xs text-white/90 truncate">
              @{MOCK_STATS.lastGame.username}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/40 uppercase tracking-wide">
              Last game
            </span>
            <span className="text-xs font-medium text-emerald-400">
              +{MOCK_STATS.lastGame.amount} GRAM
            </span>
          </div>
          <div className="text-[10px] text-white/30 mt-0.5">
            Chance {MOCK_STATS.lastGame.chance}%
          </div>
        </div>

        <div className="flex-1 rounded-xl bg-[#1a1a24] border border-white/5 px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-[10px]">
              L
            </div>
            <span className="text-xs text-white/90 truncate">
              @{MOCK_STATS.topGame.username}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/40 uppercase tracking-wide">
              Top game
            </span>
            <span className="text-xs font-medium text-emerald-400">
              +{MOCK_STATS.topGame.amount} GRAM
            </span>
          </div>
          <div className="text-[10px] text-white/30 mt-0.5">
            Chance {MOCK_STATS.topGame.chance}%
          </div>
        </div>
      </div>

      {/* Total bank + actions */}
      <div className="mx-4 mb-4 flex items-center justify-between">
        <button className="w-9 h-9 rounded-full bg-[#1a1a24] border border-white/5 flex items-center justify-center text-white/50 hover:bg-white/5 transition">
          ⏱
        </button>

        <div className="px-4 py-1.5 rounded-full bg-[#1a1a24] border border-white/10">
          <span className="text-sm font-semibold tracking-wide">
            TOTAL{" "}
            <span className="text-cyan-300">{MOCK_STATS.totalBank} GRAM</span>
          </span>
        </div>

        <button className="w-9 h-9 rounded-full bg-[#1a1a24] border border-white/5 flex items-center justify-center text-white/50 hover:bg-white/5 transition">
          💬
        </button>
      </div>

      {/* Wheel */}
      <div className="relative flex justify-center mb-5">
        {/* Pointer */}
        <div className="absolute -top-1 z-20 text-white text-xl drop-shadow-lg">
          ▼
        </div>

        <div className="relative w-56 h-56 rounded-full wheel-glow bg-gradient-to-br from-purple-600 via-violet-700 to-purple-900 flex items-center justify-center">
          {/* Outer ring highlight */}
          <div className="absolute inset-1 rounded-full border border-white/10" />

          {/* Center circle */}
          <div className="w-20 h-20 rounded-full bg-[#0a0a0f] border border-white/10 flex flex-col items-center justify-center z-10">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 mb-1 flex items-center justify-center text-xs">
              👤
            </div>
            <span className="text-[11px] text-white/70 font-medium">Waiting</span>
          </div>
        </div>
      </div>

      {/* Currency tabs + balance */}
      <div className="mx-4 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 bg-[#1a1a24] rounded-full px-2 py-1 border border-white/5">
          <button className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs">
            💎
          </button>
          <button className="w-7 h-7 rounded-full flex items-center justify-center text-xs opacity-50">
            ⭐
          </button>
          <button className="w-7 h-7 rounded-full flex items-center justify-center text-xs opacity-50">
            🌟
          </button>
        </div>

        <div className="flex items-center gap-1.5 bg-[#1a1a24] rounded-full px-3 py-1.5 border border-white/5">
          <span className="text-cyan-300 text-sm">💎</span>
          <span className="text-sm font-medium">{balance}</span>
          <button className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs ml-1">
            +
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mx-4 mb-5 flex gap-3">
        <button className="flex-1 h-12 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-semibold text-sm shadow-lg shadow-amber-500/25 active:scale-[0.98] transition">
          + Add to PvP
        </button>
        <button className="flex-1 h-12 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-1.5 active:scale-[0.98] transition">
          <span>💎</span>
          <span>{balance} Gram</span>
        </button>
      </div>

      {/* Players section */}
      <div className="mx-4 mb-2 flex items-center justify-between">
        <span className="text-sm text-white/70">
          {totalPlayers} Player{totalPlayers !== 1 ? "s" : ""}
        </span>
        <span className="text-xs text-white/40">
          ROLL #{MOCK_STATS.rollId}
        </span>
      </div>

      {/* Player list */}
      <div className="mx-4 flex-1 space-y-2 mb-20">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between rounded-xl bg-[#1a1a24] border border-white/5 px-3 py-3"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm border-2"
                style={{ borderColor: player.color }}
              >
                👤
              </div>
              <div>
                <div className="text-sm font-medium">@{player.username}</div>
                <div className="text-xs text-white/40">{player.chance}%</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-sm font-medium">
                💎 {player.amount}
              </div>
              <span className="text-white/30">›</span>
            </div>
          </div>
        ))}
      </div>

      {/* Hash (provably fair placeholder) */}
      <div className="text-center text-[10px] text-white/20 mb-16 px-4">
        Hash 440a0...8519c 🔗
      </div>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0f0f16]/95 backdrop-blur-md border-t border-white/5 px-2 pb-safe">
        <div className="flex items-center justify-around py-2 max-w-md mx-auto">
          <NavItem icon="⚔️" label="PvP" active />
          <NavItem icon="🎯" label="Solo" />
          <NavItem icon="🎁" label="Giveaways" />
          <NavItem icon="🛒" label="Shop" />
          <NavItem icon="👤" label="Profile" />
        </div>
      </nav>
    </div>
  );
}

function NavItem({
  icon,
  label,
  active = false,
}: {
  icon: string;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition ${
        active ? "text-cyan-400" : "text-white/40 hover:text-white/70"
      }`}
    >
      <span className="text-lg">{icon}</span>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
