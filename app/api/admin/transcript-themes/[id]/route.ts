import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("transcript_themes")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const supabase = await createClient();
    
    // Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();

    // Handle Default Toggle Logic
    if (body.is_default) {
       if (body.target_curriculum === 'ALL') {
           // Global Theme Activated -> Clear ALL other defaults (Global, CBC, 8-4-4)
           // This ensures the Global theme takes precedence over everything until a specific one is set again.
           await supabase.from("transcript_themes")
             .update({ is_default: false })
             .neq("id", params.id);
       } else {
           // Specific Curriculum (e.g. CBC) -> Only clear defaults for THAT curriculum
           await supabase.from("transcript_themes")
             .update({ is_default: false })
             .eq("target_curriculum", body.target_curriculum)
             .neq("id", params.id);
       }
    }

    const { data, error } = await supabase
      .from("transcript_themes")
      .update({
        name: body.name,
        colors: body.colors,
        fonts: body.fonts,
        layout: body.layout,
        is_default: body.is_default,
        target_curriculum: body.target_curriculum,
        updated_at: new Date().toISOString()
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const supabase = await createClient();
    
    // Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await supabase
      .from("transcript_themes")
      .delete()
      .eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
