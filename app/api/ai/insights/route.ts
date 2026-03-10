import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";
import { IntelligentEngine } from "@/lib/ai/IntelligentEngine";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { type, data, context } = await req.json();
    
    // We use a hash of the data to ensure we don't serve stale cached insights
    const dataHash = crypto.createHash("md5").update(JSON.stringify(data)).digest("hex");
    const contextId = context.eventId || context.studentId || context.financeId || "global";

    // 1. Check Cache First
    const supabase = await createClient();
    const { data: cachedInsight } = await supabase
      .from("ai_insights")
      .select("insight, data_hash")
      .eq("type", type)
      .eq("context_id", contextId)
      .maybeSingle();

    if (cachedInsight && cachedInsight.data_hash === dataHash) {
      console.log(`[IntelligentEngine Cache] Serving cached result for ${type}/${contextId}`);
      // Parse the insight if it's stored as a stringified JSON
      try {
        const parsed = JSON.parse(cachedInsight.insight);
        return NextResponse.json({ ...parsed, cached: true });
      } catch {
        return NextResponse.json({ insight: cachedInsight.insight, cached: true });
      }
    }

    // 2. Generate New Insight using the Intelligent Engine (Powered by CCIC)
    const result = await IntelligentEngine.process(type, data, context);
    
    // 3. Update Cache
    // We store the full structured result to avoid re-calculating indices
    const { error: upsertError } = await supabase
      .from("ai_insights")
      .upsert({
        type,
        context_id: contextId,
        insight: JSON.stringify(result),
        data_hash: dataHash,
        updated_at: new Date().toISOString()
      }, { onConflict: "type,context_id" });

    if (upsertError) {
      console.error("[AI Cache Update Error]", upsertError);
    }

    return NextResponse.json({ ...result, cached: false });
  } catch (error: any) {
    console.error("Intelligent Engine Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate intelligent insights" }, { status: 500 });
  }
}
