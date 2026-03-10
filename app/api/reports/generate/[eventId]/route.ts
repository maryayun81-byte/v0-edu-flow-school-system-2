import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { aggregateEventFinancials } from '@/lib/reports/FinancialDataAggregator';
import { generateFinancialReportPDF, generateCSV } from '@/lib/reports/ReportPDFGenerator';
import { sendFinancialReportEmail, sendFinancialReportWhatsApp } from '@/lib/reports/ReportDelivery';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await props.params;
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 1. Mark as generating (dedup check)
    const { data: status, error: statusErr } = await supabase
      .from('event_report_status')
      .upsert({ 
        event_id: eventId, 
        status: 'generating',
        attempt_count: 1, // simplified for now
        triggered_at: new Date().toISOString()
      }, { onConflict: 'event_id' })
      .select()
      .single();

    if (statusErr) throw statusErr;

    // 2. Aggregate Data
    const reportData = await aggregateEventFinancials(eventId);

    // 3. Generate Files
    const doc = generateFinancialReportPDF(reportData);
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    const csvString = generateCSV(reportData);

    // 4. Upload to Storage
    const pathPrefix = `${eventId}/${new Date().toISOString().split('T')[0]}`;
    const pdfPath = `${pathPrefix}/Financial_Report.pdf`;
    const csvPath = `${pathPrefix}/Financial_Data.csv`;

    // Ensure bucket exists (best effort)
    try {
      await supabase.storage.createBucket('financial-reports', { public: false });
    } catch (e) { /* ignore if already exists */ }

    const [pdfUpload, csvUpload] = await Promise.all([
      supabase.storage.from('financial-reports').upload(pdfPath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      }),
      supabase.storage.from('financial-reports').upload(csvPath, Buffer.from(csvString), {
        contentType: 'text/csv',
        upsert: true
      })
    ]);

    if (pdfUpload.error) throw pdfUpload.error;
    if (csvUpload.error) throw csvUpload.error;

    // Get Signed URLs or public URLs (assuming private bucket)
    const { data: pdfUrl } = await supabase.storage.from('financial-reports').getPublicUrl(pdfPath);
    const { data: csvUrl } = await supabase.storage.from('financial-reports').getPublicUrl(csvPath);

    // 5. Deliver
    await Promise.all([
      sendFinancialReportEmail(pdfBuffer, csvString, reportData, process.env.ADMIN_EMAIL!),
      sendFinancialReportWhatsApp(reportData, process.env.ADMIN_WHATSAPP_NUMBER!)
    ]);

    // 6. Archive
    await supabase.from('finance_reports_archive').insert({
      event_id: eventId,
      event_name: reportData.event.name,
      pdf_url: pdfUrl.publicUrl,
      csv_url: csvUrl.publicUrl,
      financial_summary: reportData.metrics,
      status: 'sent',
      sent_via_email: true,
      sent_via_whatsapp: true,
      recipient_email: process.env.ADMIN_EMAIL,
      sent_at: new Date().toISOString()
    });

    // 7. Mark as complete
    await supabase.from('event_report_status').update({
      status: 'sent',
      completed_at: new Date().toISOString()
    }).eq('event_id', eventId);

    return NextResponse.json({ success: true, eventId });
  } catch (error: any) {
    console.error(`[Report Engine] Error generating report for ${eventId}:`, error);

    // Log failure
    await supabase.from('event_report_status').upsert({
      event_id: eventId,
      status: 'failed',
      error_message: error.message
    }, { onConflict: 'event_id' });

    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
