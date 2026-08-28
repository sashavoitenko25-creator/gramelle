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
  const [rollId, setRollId] = useState(0);
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
    bets?: Player[];
  } | null>(null);

  const myIdRef = useRef(myTelegramId);
  const myNameRef = useRef(myName);
  const modeRef = useRef(mode);
  /** mode:rollId keys that already played spin animation */
  const handledSpinKeys = useRef<Set<string>>(new Set());
  const animatingRef = useRef(false);

  myIdRef.current = myTelegramId;
  myNameRef.current = myName;

  const mapBets = useCallback(
    (
      bets: Array<{
        telegramId: number;
        username: string;
        amount: number;
        color: string;
        photoUrl?: string | null;
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
        photoUrl: b.photoUrl || null,
      })),
    []
  );

  const refresh = useCallback(async () => {
    const currentMode = modeRef.current;
    try {
      const data = await fetchRoundState(currentMode);
      // Ignore stale responses after room switch
      if (modeRef.current !== currentMode) return;
      if (data.demo) return;

      if (data.spinResult) {
        const rid = data.spinResult.rollId;
        const key = `${currentMode}:${rid}`;
        if (!handledSpinKeys.current.has(key) && !animatingRef.current) {
          const betsMapped = mapBets(
            // @ts-expect-error optional bets on spinResult
            (data.spinResult.bets as typeof data.bets) || data.bets
          );
          setPendingSpin({
            spinDegrees: data.spinResult.spinDegrees,
            winnerTelegramId: data.spinResult.winnerTelegramId,
            winnerUsername: data.spinResult.winnerUsername,
            mult: data.spinResult.mult,
            total: data.spinResult.total,
            potAfterFee: data.spinResult.potAfterFee,
            houseFee: data.spinResult.houseFee,
            serverSeed: data.spinResult.serverSeed,
            bets: betsMapped,
          });
          if (betsMapped.length) setPlayers(betsMapped);
          setRollId(rid);
          setRoundStatus("finished");
          return;
        }
      }

      if (animatingRef.current) return;

      if (data.round) {
        setRollId(data.round.rollId);
        setRoundStatus(data.round.status);
        setCountdownEndsAt(data.round.countdownEndsAt || null);
        setServerSeedHash(data.round.serverSeedHash || null);
        if (data.round.status !== "finished") {
          setPlayers(mapBets(data.bets));
        }
      } else {
        setPlayers([]);
        setRoundStatus("open");
        setCountdownEndsAt(null);
        setServerSeedHash(null);
      }
    } catch {
      // offline / demo
    }
  }, [mapBets]);

  // Full room isolation when mode changes
  useEffect(() => {
    modeRef.current = mode;
    animatingRef.current = false;
    setPlayers([]);
    setPendingSpin(null);
    setCountdownEndsAt(null);
    setRoundStatus("open");
    setServerSeedHash(null);
    setRollId(0);
    void refresh();
  }, [mode, refresh]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 2000);
    return () => clearInterval(id);
  }, [refresh, mode]);

  const applyServerBets = useCallback(
    (
      bets: Array<{
        telegramId: number;
        username: string;
        amount: number;
        color: string;
        isMe?: boolean;
        photoUrl?: string | null;
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
          photoUrl: b.photoUrl || null,
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
      handledSpinKeys.current.add(`${modeRef.current}:${rollId}`);
    }
    setPendingSpin(null);
  }, [pendingSpin, rollId]);

  const setAnimating = useCallback((v: boolean) => {
    animatingRef.current = v;
  }, []);

  const triggerSpin = useCallback(async () => {
    const currentMode = modeRef.current;
    const result = await requestSpin(currentMode);
    if (modeRef.current !== currentMode) return result;
    const mapped = result.bets ? mapBets(result.bets) : undefined;
    setPendingSpin({
      spinDegrees: result.spinDegrees,
      winnerTelegramId: result.winner.telegramId,
      winnerUsername: result.winner.username,
      mult: result.mult,
      total: result.total,
      potAfterFee: result.potAfterFee,
      houseFee: result.houseFee,
      serverSeed: result.serverSeed,
      bets: mapped,
    });
    if (mapped) setPlayers(mapped);
    return result;
  }, [mapBets]);

  const clearRoundLocal = useCallback((nextRollId: number) => {
    setPlayers([]);
    setRollId(nextRollId);
    setRoundStatus("open");
    setCountdownEndsAt(null);
    setPendingSpin(null);
    animatingRef.current = false;
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
    setAnimating,
  };
}
