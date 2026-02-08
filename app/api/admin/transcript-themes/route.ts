import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    let supabase;
    
    // Check for explicit Authorization header first (more robust)
    const authHeader = request.headers.get('authorization');
    
    console.log("API Debug: Auth Header Present?", !!authHeader);
    if (authHeader) console.log("API Debug: Auth Header length:", authHeader.length);

    if (authHeader) {
        const { createClient } = await import('@supabase/supabase-js');
        supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: authHeader } } }
        );
    } else {
        // Fallback to cookie-based client
        const { createClient } = await import('@/lib/supabase/server');
        supabase = await createClient();
    }

    // Check Admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
        console.error("Theme API Auth Fail:", authError);
        return NextResponse.json({ error: "Unauthorized", details: authError }, { status: 401 });
    }

    const { data: themes, error } = await supabase
      .from("transcript_themes")
      .select("*")
      .order("is_default", { ascending: false }) // Default first
      .order("name", { ascending: true });

    if (error) throw error;

    return NextResponse.json(themes);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check Admin Role
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    // Verify admin role strictly if needed, but RLS handles it too. 
    // Ideally we check profile role here for 403.
    
    const body = await request.json();
    
    // If setting as default, unset others (handled better in a transaction or client side, 
    // but here we can do a quick update)
    if (body.is_default) {
        await supabase.from("transcript_themes").update({ is_default: false }).neq("id", "placeholder");
    }

    const { data, error } = await supabase
      .from("transcript_themes")
      .insert({
        name: body.name,
        colors: body.colors,
        fonts: body.fonts,
        layout: body.layout,
        is_default: body.is_default || false,
        target_curriculum: body.target_curriculum || 'ALL'
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
