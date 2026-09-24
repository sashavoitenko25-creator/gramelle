import { NextRequest, NextResponse } from "next/server";
import { AdminError, requireAdmin } from "@/lib/server/admin";
import { getAdminClient } from "@/lib/server/supabase";

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const db = getAdminClient();
    const { data, error } = await db.from("promo_codes").select("*").order("created_at",{ascending:false}).limit(500);
    if (error) throw error;
    const { data: analytics, error: aErr } = await db.rpc("promo_code_analytics");
    if (aErr) throw aErr;
    const byId = new Map((analytics || []).map((x:any) => [String(x.promo_id), x]));
    const items=(data||[]).map((p:any)=>{
      const a:any = byId.get(String(p.id)) || {};
      return {
        ...p,
        redemptions: Number(a.redemptions || 0),
        coupons_issued: Number(a.coupons_issued || 0),
        coupons_active: Number(a.coupons_active || 0),
        coupons_used: Number(a.coupons_used || 0),
        coupon_value: Number(a.coupon_value || 0),
        balance_granted: Number(a.balance_granted || 0),
      };
    });
    return NextResponse.json({ok:true,items});
  } catch(e) {
    if(e instanceof AdminError) return NextResponse.json({error:e.message},{status:e.status});
    return NextResponse.json({error:e instanceof Error?e.message:"Failed"},{status:500});
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const body=await req.json().catch(()=>({}));
    const code=String(body.code||"").trim().toUpperCase();
    const rewardType=body.reward_type==="coupon"?"coupon":"balance";
    const amount=Number(body.amount);
    const maxUses=Math.floor(Number(body.max_uses));
    const game=rewardType==="coupon" ? (body.game ? String(body.game) : null) : null;
    const expiresAt=body.expires_at ? new Date(body.expires_at).toISOString() : null;
    if(!/^[A-Z0-9_-]{3,64}$/.test(code)) throw new Error("Code must contain A-Z, 0-9, _ or -");
    if(!Number.isFinite(amount)||amount<=0) throw new Error("Invalid amount");
    if(!Number.isInteger(maxUses)||maxUses<1) throw new Error("Invalid max uses");
    if(rewardType==="coupon" && !["rps","dice","xo","roulette","pvp_roulette","all"].includes(game||"")) throw new Error("Invalid game");
    const {data,error}=await getAdminClient().from("promo_codes").insert({
      code,reward_type:rewardType,amount,max_uses:maxUses,game,expires_at:expiresAt
    }).select("*").single();
    if(error) throw error;
    return NextResponse.json({ok:true,item:data});
  } catch(e) {
    if(e instanceof AdminError) return NextResponse.json({error:e.message},{status:e.status});
    return NextResponse.json({error:e instanceof Error?e.message:"Failed"},{status:400});
  }
}

export async function PATCH(req: NextRequest) {
  try {
    requireAdmin(req);
    const body=await req.json().catch(()=>({}));
    const id=String(body.id||"");
    if(!id) throw new Error("id required");
    const {data,error}=await getAdminClient().from("promo_codes").update({active:Boolean(body.active)}).eq("id",id).select("*").single();
    if(error) throw error;
    return NextResponse.json({ok:true,item:data});
  } catch(e) {
    if(e instanceof AdminError) return NextResponse.json({error:e.message},{status:e.status});
    return NextResponse.json({error:e instanceof Error?e.message:"Failed"},{status:400});
  }
}
