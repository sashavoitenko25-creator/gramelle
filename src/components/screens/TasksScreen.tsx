"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchTasks, claimTask } from "@/lib/api";
import { formatGram, cn } from "@/lib/utils";
import { GramIcon } from "@/components/ui/GramIcon";
import { useI18n } from "@/lib/i18n/context";

interface TaskRow {
  id: string;
  title: string;
  description: string;
  channel: string;
  channelLink: string;
  rewardGram: number;
  completed: boolean;
}

interface Props {
  onBack?: () => void;
  openLink?: (url: string) => void;
  showToast?: (msg: string) => void;
  haptic?: (t?: "light" | "medium" | "heavy") => void;
  hapticSuccess?: () => void;
  hapticError?: () => void;
  onRewarded?: (balance?: number) => void;
}

export function TasksScreen({
  onBack,
  openLink,
  showToast,
  haptic,
  hapticSuccess,
  hapticError,
  onRewarded,
}: Props) {
  const { t } = useI18n();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchTasks();
      setTasks(res.tasks || []);
    } catch (e) {
      showToast?.(e instanceof Error ? e.message : t("loading"));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openChannel = (task: TaskRow) => {
    haptic?.("light");
    if (openLink) openLink(task.channelLink);
    else window.open(task.channelLink, "_blank");
  };

  const check = async (task: TaskRow) => {
    if (task.completed || busyId) return;
    setBusyId(task.id);
    haptic?.("light");
    try {
      const res = await claimTask(task.id);
      hapticSuccess?.();
      showToast?.(`+${formatGram(res.rewardGram)} GRAM`);
      setTasks((prev) =>
        prev.map((x) => (x.id === task.id ? { ...x, completed: true } : x))
      );
      onRewarded?.(res.balance);
    } catch (e) {
      hapticError?.();
      showToast?.(e instanceof Error ? e.message : t("taskCheckFailed"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 safe-top">
      <div className="flex items-center justify-between px-4 pt-3 pb-3">
        {onBack ? (
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-white/50 btn-press"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        ) : (
          <div className="w-9" />
        )}
        <h2 className="text-base font-semibold tracking-tight">{t("tasksTitle")}</h2>
        <div className="w-9" />
      </div>

      <p className="px-4 text-[12px] text-white/40 mb-3 leading-relaxed">
        {t("tasksHint")}
      </p>

      <div className="px-4 space-y-3">
        {loading && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 text-center text-sm text-white/40">
            Loading…
          </div>
        )}
        {!loading &&
          tasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                "rounded-2xl border px-4 py-4",
                task.completed
                  ? "border-emerald-500/25 bg-emerald-500/[0.06]"
                  : "border-white/[0.08] bg-white/[0.03]"
              )}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white/90">
                    {task.title}
                  </div>
                  <div className="text-[12px] text-white/40 mt-1">
                    {task.description}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-sm font-semibold text-cyan-300 tabular-nums">
                  <span>+{formatGram(task.rewardGram)}</span>
                  <GramIcon size={16} />
                </div>
              </div>

              {task.completed ? (
                <div className="h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-sm font-medium flex items-center justify-center">
                  {t("completed")}
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openChannel(task)}
                    className="flex-1 h-10 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white/75 btn-press"
                  >
                    {t("openChannel")}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === task.id}
                    onClick={() => void check(task)}
                    className="flex-1 h-10 rounded-xl btn-primary text-sm font-medium btn-press disabled:opacity-50"
                  >
                    {busyId === task.id ? t("loading") : t("check")}
                  </button>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
