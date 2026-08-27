"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchRoundState, requestSpin } from "@/lib/api";
import { DEFAULT_ROOM, type RoomMode } from "@/lib/constants";
import type { Player } from "@/lib/types";

export function useRound(
  myTelegramId: number | null,
  myName: string,
  mode: RoomMode = DEFAULT_ROOM
) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [rollId, setRollId] = useState(
    () => 600000 + Math.floor(Math.random() * 50000)
  );
  const [roundStatus, setRoundStatus] = useState<string>("open");
  const [countdownEndsAt, setCountdownEndsAt] = useState<string | null>(null);
  const [serverSeedHash, setServerSeedHash] = useState<string | null>(null);
  const [pendingSpin, setPendingSpin] = useState<{
    spinDegrees: number;
    winnerTelegramId: number;
    winnerUsername: string;
    mult: number;
    total: number;
    potAfterFee: number;
    houseFee: number;
    serverSeed?: string;
  } | null>(null);

  const myIdRef = useRef(myTelegramId);
  const myNameRef = useRef(myName);
  const modeRef = useRef(mode);
  const handledSpinRoll = useRef<number | null>(null);

  myIdRef.current = myTelegramId;
  myNameRef.current = myName;
  modeRef.current = mode;

  const mapBets = useCallback(
    (
      bets: Array<{
        telegramId: number;
        username: string;
        amount: number;
        color: string;
      }>
    ): Player[] =>
      bets.map((b) => ({
        id: b.telegramId,
        name: b.username,
        amount: b.amount,
        color: b.color,
        isMe: myIdRef.current
          ? b.telegramId === myIdRef.current
          : b.username === myNameRef.current,
        telegramId: b.telegramId,
      })),
    []
  );

  const refresh = useCallback(async () => {
    try {
      const data = await fetchRoundState(modeRef.current);
      if (data.demo) return;

      if (data.spinResult) {
        const rid = data.spinResult.rollId;
        if (handledSpinRoll.current !== rid) {
          setPendingSpin({
            spinDegrees: data.spinResult.spinDegrees,
            winnerTelegramId: data.spinResult.winnerTelegramId,
            winnerUsername: data.spinResult.winnerUsername,
            mult: data.spinResult.mult,
            total: data.spinResult.total,
            potAfterFee: data.spinResult.potAfterFee,
            houseFee: data.spinResult.houseFee,
            serverSeed: data.spinResult.serverSeed,
          });
        }
        setPlayers(mapBets(data.bets));
        if (data.round) setRollId(data.round.rollId);
        setRoundStatus("finished");
        return;
      }

      if (data.round) {
        setRollId(data.round.rollId);
        setRoundStatus(data.round.status);
        setCountdownEndsAt(data.round.countdownEndsAt || null);
        setServerSeedHash(data.round.serverSeedHash || null);
        setPlayers(mapBets(data.bets));
      } else {
        setPlayers([]);
        setRoundStatus("open");
        setCountdownEndsAt(null);
      }
    } catch {
      // offline / demo
    }
  }, [mapBets]);

  // Reset when room changes
  useEffect(() => {
    setPlayers([]);
    setPendingSpin(null);
    setCountdownEndsAt(null);
    setRoundStatus("open");
    handledSpinRoll.current = null;
    refresh();
  }, [mode, refresh]);

  useEffect(() => {
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, [refresh]);

  const applyServerBets = useCallback(
    (
      bets: Array<{
        telegramId: number;
        username: string;
        amount: number;
        color: string;
        isMe?: boolean;
      }>,
      roll: number,
      status: string,
      endsAt?: string
    ) => {
      setPlayers(
        bets.map((b) => ({
          id: b.telegramId,
          name: b.username,
          amount: b.amount,
          color: b.color,
          isMe:
            b.isMe ??
            (myIdRef.current
              ? b.telegramId === myIdRef.current
              : b.username === myNameRef.current),
          telegramId: b.telegramId,
        }))
      );
      setRollId(roll);
      setRoundStatus(status);
      setCountdownEndsAt(endsAt || null);
    },
    []
  );

  const clearPendingSpin = useCallback(() => {
    if (pendingSpin) {
      handledSpinRoll.current = rollId;
    }
    setPendingSpin(null);
  }, [pendingSpin, rollId]);

  const triggerSpin = useCallback(async () => {
    const result = await requestSpin(modeRef.current);
    setPendingSpin({
      spinDegrees: result.spinDegrees,
      winnerTelegramId: result.winner.telegramId,
      winnerUsername: result.winner.username,
      mult: result.mult,
      total: result.total,
      potAfterFee: result.potAfterFee,
      houseFee: result.houseFee,
      serverSeed: result.serverSeed,
    });
    if (result.bets) setPlayers(mapBets(result.bets));
    return result;
  }, [mapBets]);

  const clearRoundLocal = useCallback((nextRollId: number) => {
    setPlayers([]);
    setRollId(nextRollId);
    setRoundStatus("open");
    setCountdownEndsAt(null);
    setPendingSpin(null);
  }, []);

  return {
    players,
    setPlayers,
    rollId,
    setRollId,
    roundStatus,
    countdownEndsAt,
    serverSeedHash,
    pendingSpin,
    clearPendingSpin,
    refresh,
    applyServerBets,
    triggerSpin,
    clearRound: clearRoundLocal,
  };
}
