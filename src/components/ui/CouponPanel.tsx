"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchCoupons, redeemPromo, type Coupon, type CouponGame } from "@/lib/couponsApi";
import { formatGram } from "@/lib/utils";

const gameLabel: Record<string,string> = { all:"Все игры", rps:"RPS", dice:"Dice", xo:"XO", roulette:"Roulette", pvp_roulette:"PvP Roulette" };

export function CouponPanel({ open, onClose, onChanged, compact=false }: { open:boolean; onClose:()=>void; onChanged?:(n:number,total:number)=>void; compact?:boolean }) {
  const [coupons,setCoupons]=useState<Coupon[]>([]);
  const [code,setCode]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const load=async()=>{try{const r=await fetchCoupons();setCoupons(r.coupons);onChanged?.(r.count,r.total);}catch(e){setError(e instanceof Error?e.message:"Ошибка");}};
  useEffect(()=>{if(open) void load();},[open]);
  const total=useMemo(()=>coupons.reduce((s,c)=>s+Number(c.amount),0),[coupons]);
  if(!open)return null;
  const redeem=async()=>{if(!code.trim())return;setLoading(true);setError("");try{await redeemPromo(code.trim());setCode("");await load();}catch(e){setError(e instanceof Error?e.message:"Ошибка");}finally{setLoading(false);}};
  return <div className="fixed inset-0 z-[120] flex items-end justify-center">
    <button className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="Close"/>
    <div className="relative w-full max-w-lg rounded-t-[28px] border border-white/10 bg-[#0c0c14] p-4 pb-8 safe-bottom shadow-2xl max-h-[82dvh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4"><div><div className="text-base font-semibold">Промокоды и купоны</div><div className="text-[11px] text-white/35 mt-0.5">{coupons.length} шт. · {formatGram(total)} GRAM</div></div><button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/[0.05] text-white/45">✕</button></div>
      <div className="rounded-2xl bg-gradient-to-br from-violet-500/15 to-cyan-500/10 border border-violet-400/15 p-3 mb-3"><div className="text-[10px] uppercase tracking-wider text-white/35">Активные купоны</div><div className="text-2xl font-bold mt-1">{coupons.length} <span className="text-sm text-white/35 font-normal">({formatGram(total)} GRAM)</span></div></div>
      <div className="flex gap-2 mb-4"><input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} onKeyDown={e=>{if(e.key==="Enter")void redeem();}} placeholder="Введите промокод" className="flex-1 h-11 rounded-xl bg-white/[0.04] border border-white/10 px-3 text-sm outline-none focus:border-violet-400/40"/><button disabled={loading} onClick={redeem} className="h-11 px-4 rounded-xl btn-primary text-sm font-semibold disabled:opacity-50">Активировать</button></div>
      {error&&<div className="mb-3 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-300">{error}</div>}
      <div className="space-y-2">{coupons.length===0?<div className="text-center py-8 text-sm text-white/30">Купонов пока нет</div>:coupons.map(c=><div key={c.id} className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-3.5 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-400/20 flex items-center justify-center text-lg">🎟️</div><div className="flex-1 min-w-0"><div className="font-semibold">{formatGram(c.amount)} GRAM</div><div className="text-[11px] text-white/35 mt-0.5">{gameLabel[c.game||"all"]||c.game||"Все игры"}{c.promo_code?` · ${c.promo_code}`:""}</div></div><div className="text-[10px] text-emerald-300/80">АКТИВЕН</div></div>)}</div>
    </div>
  </div>;
}

export function CouponBalance({ count, total, onClick }: {count:number;total:number;onClick:()=>void}) {
  return <button onClick={onClick} className="w-full rounded-2xl bg-gradient-to-r from-violet-500/12 to-cyan-500/8 border border-violet-400/15 px-4 py-3 flex items-center justify-between text-left btn-press"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center">🎟️</div><div><div className="text-[10px] text-white/35 uppercase tracking-wider">Купоны</div><div className="text-sm font-semibold">{count} шт. <span className="text-white/35 font-normal">({formatGram(total)} GRAM)</span></div></div></div><span className="text-white/25">›</span></button>;
}
