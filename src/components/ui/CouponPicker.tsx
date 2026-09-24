"use client";
import { useEffect, useState } from "react";
import { fetchCoupons, type Coupon, type CouponGame } from "@/lib/couponsApi";
import { formatGram } from "@/lib/utils";

const labels:Record<string,string>={all:"Все игры",rps:"RPS",dice:"Dice",xo:"XO",roulette:"Roulette",pvp_roulette:"PvP Roulette"};
export function CouponPicker({ game, onSelect, disabled=false }: {game:CouponGame; onSelect:(coupon:Coupon)=>void; disabled?:boolean}) {
 const [open,setOpen]=useState(false); const [items,setItems]=useState<Coupon[]>([]); const [loading,setLoading]=useState(false);
 const load=async()=>{setLoading(true);try{const r=await fetchCoupons();setItems(r.coupons.filter(c=>!c.game||c.game==="all"||c.game===game));}catch{}finally{setLoading(false)}};
 useEffect(()=>{if(open)void load()},[open]);
 return <>
  <button type="button" disabled={disabled} onClick={()=>setOpen(true)} className="w-full mt-2 h-10 rounded-xl bg-violet-500/10 border border-violet-400/20 text-violet-200 text-xs font-semibold disabled:opacity-40">🎟️ Использовать купон</button>
  {open&&<div className="fixed inset-0 z-[130] flex items-end justify-center"><button className="absolute inset-0 bg-black/60" onClick={()=>setOpen(false)}/><div className="relative w-full max-w-lg rounded-t-[28px] bg-[#0c0c14] border border-white/10 p-4 pb-8 safe-bottom max-h-[70dvh] overflow-y-auto"><div className="flex justify-between items-center mb-4"><div><div className="font-semibold">Выберите купон</div><div className="text-[11px] text-white/35 mt-1">{labels[game]} · {items.length} доступно</div></div><button onClick={()=>setOpen(false)} className="w-8 h-8 rounded-xl bg-white/[0.05]">✕</button></div>{loading?<div className="py-8 text-center text-white/30">Загрузка…</div>:items.length===0?<div className="py-8 text-center text-sm text-white/30">Подходящих купонов нет</div>:<div className="space-y-2">{items.map(c=><button key={c.id} onClick={()=>{onSelect(c);setOpen(false)}} className="w-full rounded-2xl bg-white/[0.03] border border-white/[0.07] p-3.5 flex items-center text-left hover:bg-white/[0.05]"><span className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center mr-3">🎟️</span><span className="flex-1"><span className="block font-semibold">{formatGram(c.amount)} GRAM</span><span className="block text-[11px] text-white/35 mt-0.5">{labels[c.game||"all"]||"Все игры"}</span></span><span className="px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-200 text-xs font-semibold">Использовать</span></button>)}</div>}</div></div>}
 </>;
}
