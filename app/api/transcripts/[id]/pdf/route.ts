
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsPDF } from "jspdf";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const transcriptId = params.id;
    
    // 1. Auth & Validation
    const authHeader = request.headers.get('authorization');
    let supabase;
    let user;
    
    // Auth Setup
    if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { createClient } = await import('@supabase/supabase-js');
        supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: authHeader } } }
        );
        const userRes = await supabase.auth.getUser(token);
        user = userRes.data.user;
    } else {
        const { createClient } = await import('@/lib/supabase/server');
        supabase = await createClient();
        const userRes = await supabase.auth.getUser();
        user = userRes.data.user;
    }
    
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    // Fetch Data
    const { data: transcript, error: transcriptError } = await supabase
        .from("transcripts")
        .select(`*, exams!inner(exam_name, academic_year, term), profiles!inner(full_name, admission_number, form_class, curriculum_type)`)
        .eq("id", transcriptId)
        .eq("status", "Published")
        .maybeSingle(); 
        
    if (!transcript) return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
    const { data: settings } = await supabase.from("school_settings").select("*").single();
    const { data: items } = await supabase.from("transcript_items").select("*").eq("transcript_id", transcriptId).order("subject_name", { ascending: true });

    // Theme Logic
    let themeToUse = null;
    const { data: curriculumTheme } = await supabase.from("transcript_themes").select("*").eq("is_default", true).eq("target_curriculum", transcript.profiles?.curriculum_type || 'ALL').maybeSingle();
    themeToUse = curriculumTheme;
    
    if (!themeToUse) {
        const { data: globalTheme } = await supabase.from("transcript_themes").select("*").eq("is_default", true).eq("target_curriculum", 'ALL').maybeSingle();
        themeToUse = globalTheme || (await supabase.from("transcript_themes").select("*").eq("is_default", true).maybeSingle()).data;
    }
        
    const theme = themeToUse || {
        colors: { primary: "#000000", secondary: "#666666", accent: "#000000", text: "#000000", background: "#ffffff" },
        fonts: { header: "Helvetica", body: "Helvetica", table: "Helvetica" },
        layout: { header_style: "modern", table_style: "lines", footer_style: "standard", show_border: true, show_watermark: true }
    };
    
    // Colors & Setup
    const { primary, secondary, accent, text, background } = theme.colors;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;

    // --- Helpers ---
    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 };
    }
    
    const fetchImage = async (url: string) => {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error("Fetch failed");
            return new Uint8Array(await res.arrayBuffer());
        } catch (e) { return null; }
    };

    const centerText = (txt: string, y: number, size: number, font: string, bold: boolean) => {
        doc.setFontSize(size);
        doc.setFont(font, bold ? "bold" : "normal");
        doc.text(txt, (pageWidth - doc.getTextWidth(txt)) / 2, y);
    }
    
    // --- 1. Background & Watermark ---
    doc.setFillColor(background || "#ffffff");
    doc.rect(0, 0, pageWidth, pageHeight, "F");

    // Decorative Sidebar (Premium Touch)
    if (theme.layout.header_style === 'modern') {
         doc.setFillColor(primary);
         doc.rect(0, 0, 8, pageHeight, "F"); // Left accent bar
    }

    if (theme.layout.show_watermark && settings?.logo_url) {
        // NOTE: GState/Opacity logic disabled for stability.
        // We log here to acknowledge the config but skip the render to avoid crashes.
        // console.log("Watermark skipped for stability.");
    }

    // --- 2. Header Section ---
    let yPos = 30;
    const logoData = (settings?.logo_url && typeof settings.logo_url === 'string') ? await fetchImage(settings.logo_url) : null;
    
    const schoolName = typeof settings?.school_name === 'string' ? settings.school_name : "SCHOOL NAME";

    if (theme.layout.header_style === "flat_bar") {
        // Flat Bar Design
        doc.setFillColor(primary);
        doc.rect(margin, 20, pageWidth - (margin*2), 35, "F");
        if (logoData) try { doc.addImage(logoData, "PNG", margin + 10, 25, 25, 25); } catch(e){}
        
        doc.setTextColor("#ffffff");
        doc.setFontSize(22);
        doc.setFont(theme.fonts.header, "bold");
        doc.text(schoolName.toUpperCase(), margin + 45, 38);
        
        doc.setFontSize(9);
        doc.setFont(theme.fonts.body, "normal");
        doc.text("Excellence • Integrity • Knowledge", margin + 45, 46);
        yPos = 70;
    } else {
        // Modern / Centered
        if (logoData) try { doc.addImage(logoData, "PNG", (pageWidth - 30)/2, 20, 30, 30); } catch(e){}
        
        yPos = 55;
        doc.setTextColor(primary);
        centerText(schoolName.toUpperCase(), yPos, 20, theme.fonts.header, true);
        yPos += 7;
        doc.setTextColor(secondary);
        centerText("Excellence • Knowledge • Innovation", yPos, 9, theme.fonts.body, false);
        yPos += 15;
    }

    // Title Separator
    const title = "OFFICIAL ACADEMIC TRANSCRIPT";
    doc.setDrawColor(primary);
    doc.setLineWidth(0.5);
    
    // Elegant lines around title
    doc.setFontSize(11);
    doc.setFont(theme.fonts.header, "bold");
    doc.setTextColor(primary);
    
    const centerX = pageWidth / 2;
    doc.text(title, centerX - (doc.getTextWidth(title)/2), yPos);
    
    // Decorative lines
    doc.line(margin + 20, yPos - 1, centerX - (doc.getTextWidth(title)/2) - 5, yPos - 1);
    doc.line(centerX + (doc.getTextWidth(title)/2) + 5, yPos - 1, pageWidth - margin - 20, yPos - 1);
    
    yPos += 15;

    // --- 3. Student Details (Premium Cards) ---
    doc.setFont(theme.fonts.body, "normal");
    
    // Two Column Layout
    const leftX = margin + 10;
    const rightX = pageWidth / 2 + 10;
    
    // Background Container
    doc.setFillColor(250, 250, 250);
    if (!theme.colors.background || theme.colors.background === '#ffffff') {
        doc.roundedRect(margin, yPos - 5, pageWidth - (margin*2), 35, 3, 3, "F");
    }
    
    const labelColor = secondary;
    const valueColor = text;
    
    doc.setFontSize(8); doc.setTextColor(labelColor);
    doc.text("STUDENT NAME", leftX, yPos + 5);
    doc.text("ADMISSION NO", rightX, yPos + 5);
    
    // Use fallbacks for all profile fields
    const fullName = transcript.profiles?.full_name || "";
    const admNo = transcript.profiles?.admission_number || "";
    const formClass = transcript.profiles?.form_class || "";
    const examName = transcript.exams?.exam_name || "";
    const academicYear = transcript.exams?.academic_year || "";
    const term = transcript.exams?.term || "";

    doc.setFontSize(11); doc.setTextColor(valueColor); doc.setFont(undefined, 'bold');
    doc.text(fullName, leftX, yPos + 11);
    doc.text(admNo, rightX, yPos + 11);
    
    doc.setFontSize(8); doc.setTextColor(labelColor); doc.setFont(undefined, 'normal');
    doc.text("CURRENT CLASS", leftX, yPos + 20);
    doc.text("ACADEMIC PERIOD", rightX, yPos + 20);
    
    doc.setFontSize(11); doc.setTextColor(valueColor); doc.setFont(undefined, 'bold');
    doc.text(formClass, leftX, yPos + 26);
    doc.text(`${examName} (${term} ${academicYear})`, rightX, yPos + 26);
    
    yPos += 45;

    // --- 4. Results Table ---
    const isCBC = transcript.profiles?.curriculum_type === 'CBC';
    
    // Modern Table Header
    doc.setFillColor(primary);
    doc.roundedRect(margin, yPos, pageWidth - (margin*2), 10, 2, 2, "F");
    
    doc.setTextColor("#ffffff");
    doc.setFontSize(9);
    doc.setFont(theme.fonts.table, "bold");
    
    const col1 = margin + 5; // Subject
    const col2 = isCBC ? 0 : margin + 100; // Score
    const col3 = isCBC ? margin + 90 : margin + 120; // Grade
    const col4 = isCBC ? margin + 120 : margin + 140; // Remarks
    
    doc.text("SUBJECT", col1, yPos + 6);
    if (!isCBC) doc.text("SCORE", col2, yPos + 6);
    doc.text(isCBC ? "LEVEL" : "GRADE", col3, yPos + 6);
    doc.text("REMARKS", col4, yPos + 6);
    
    yPos += 12;
    doc.setTextColor(text);
    doc.setFont(theme.fonts.table, "normal");
    
    items?.forEach((item: any, i: number) => {
        // Striping
        if (i % 2 === 0) {
            doc.setFillColor(248, 249, 250); // Very light gray
            doc.rect(margin, yPos - 4, pageWidth - (margin*2), 8, "F");
        }
        
        doc.text((item.subject_name || "").substring(0, 35), col1, yPos + 1);
        if (!isCBC) doc.text(String(item.score || 0), col2, yPos + 1);
        
        // Grade Pill Logic
        const gradeColor = item.grade === 'A' ? "#166534" : (item.grade === 'E' ? "#991b1b" : primary);
        doc.setTextColor(gradeColor);
        doc.setFont(undefined, "bold");
        doc.text(item.grade || "-", col3, yPos + 1);
        
        doc.setTextColor(secondary);
        doc.setFont(undefined, "normal");
        doc.setFontSize(8);
        doc.text((item.teacher_remarks || "").substring(0, 30), col4, yPos + 1);
        
        // Reset
        doc.setTextColor(text);
        doc.setFontSize(9);
        
        yPos += 8;
        
        // Pagination
        if (yPos > pageHeight - 50) {
            doc.addPage();
            doc.setFillColor(background || "#ffffff");
            doc.rect(0, 0, pageWidth, pageHeight, "F");
             if (theme.layout.header_style === 'modern') {
                 doc.setFillColor(primary);
                 doc.rect(0, 0, 8, pageHeight, "F"); 
            }
            yPos = 30;
        }
    });
    
    yPos += 10;

    // --- 5. Summary Section (Grid Layout to fix overlap) ---
    if (!isCBC) {
        // 2x2 Grid Layout
        const boxW = (pageWidth - (margin*2) - 10) / 2; // 2 boxes per row with 10mm gap
        const boxH = 20;
        
        // Row 1
        const r1y = yPos;
        // Box 1: Total
        doc.setDrawColor(primary);
        doc.roundedRect(margin, r1y, boxW, boxH, 2, 2, "S");
        doc.setFontSize(8); doc.setTextColor(secondary);
        doc.text("TOTAL SCORE", margin + 10, r1y + 6);
        doc.setFontSize(12); doc.setTextColor(primary); doc.setFont(undefined, "bold");
        doc.text(String(transcript.total_score || 0), margin + 10, r1y + 14);
        
        // Box 2: Average
        doc.roundedRect(margin + boxW + 10, r1y, boxW, boxH, 2, 2, "S");
        doc.setFontSize(8); doc.setTextColor(secondary); doc.setFont(undefined, "normal");
        doc.text("AVERAGE SCORE", margin + boxW + 20, r1y + 6);
        doc.setFontSize(12); doc.setTextColor(primary); doc.setFont(undefined, "bold");
        doc.text(`${transcript.average_score || 0}%`, margin + boxW + 20, r1y + 14);
        
        const r2y = yPos + boxH + 5;
        // Box 3: Grade
        doc.setDrawColor(primary);
        doc.roundedRect(margin, r2y, boxW, boxH, 2, 2, "S");
        doc.setFontSize(8); doc.setTextColor(secondary); doc.setFont(undefined, "normal");
        doc.text("MEAN GRADE", margin + 10, r2y + 6);
        doc.setFontSize(12); doc.setTextColor(primary); doc.setFont(undefined, "bold");
        doc.text(transcript.overall_grade || "-", margin + 10, r2y + 14);
        
        // Box 4: Position
        doc.roundedRect(margin + boxW + 10, r2y, boxW, boxH, 2, 2, "S");
        doc.setFontSize(8); doc.setTextColor(secondary); doc.setFont(undefined, "normal");
        doc.text("CLASS POSITION", margin + boxW + 20, r2y + 6);
        doc.setFontSize(12); doc.setTextColor(primary); doc.setFont(undefined, "bold");
        doc.text(String(transcript.class_position || "-"), margin + boxW + 20, r2y + 14);
        
        yPos = r2y + boxH + 15;
    } else {
        // CBC Summary
        doc.setFontSize(12); doc.setTextColor(primary);
        doc.text(`Performance Level: ${transcript.overall_grade || "-"}`, margin, yPos);
        yPos += 20;
    }
    
    // --- 6. Footer (Pagination Check) ---
    if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = 30;
    }
    
    // Director's Remarks
    doc.setFontSize(8); doc.setTextColor(secondary);
    doc.text("HEAD TEACHER'S REMARKS", margin, yPos);
    
    doc.setFontSize(10); doc.setTextColor(text); doc.setFont(undefined, 'italic');
    doc.text(transcript.admin_remarks || "A diligent and disciplined student.", margin, yPos + 6);
    
    doc.setDrawColor(secondary);
    doc.line(margin, yPos + 10, pageWidth - margin, yPos + 10);
    
    yPos += 25;
    
    // Signatures
    const sigY = yPos;
    if (settings?.auto_attach_signature && settings?.signature_url && typeof settings.signature_url === 'string') {
        const sig = await fetchImage(settings.signature_url);
        if (sig) try { doc.addImage(sig, "PNG", margin, sigY - 15, 30, 15); } catch(e){}
    }
    
    doc.setFontSize(8); doc.setTextColor(secondary); doc.setFont(undefined, "normal");
    doc.text("----------------------------------------", margin, sigY);
    doc.text("AUTHORIZED SIGNATURE", margin, sigY + 5);
    
    // Stamp
    if (settings?.auto_attach_stamp && settings?.stamp_url && typeof settings.stamp_url === 'string') {
        const stamp = await fetchImage(settings.stamp_url);
        if (stamp) try { doc.addImage(stamp, "PNG", pageWidth - margin - 40, sigY - 20, 30, 30); } catch(e){}
    }
    
    doc.text("----------------------------------------", pageWidth - margin - 50, sigY);
    doc.text(`DATE ISSUED: ${new Date().toLocaleDateString()}`, pageWidth - margin - 50, sigY + 5);
    
    // Final Border
    if (theme.layout.show_border) {
        doc.setDrawColor(primary);
        doc.setLineWidth(1);
        doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
        // Inner thin line for classic feel
        doc.setLineWidth(0.2);
        doc.rect(12, 12, pageWidth - 24, pageHeight - 24);
    }
    
    // QR Code Placeholder (Visual Only - Premium Touch)
    doc.setFillColor(primary);
    doc.rect(pageWidth - margin - 15, pageHeight - margin - 15, 10, 10, "F");
    
    return new NextResponse(doc.output("arraybuffer"), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="Transcript.pdf"` },
    });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
