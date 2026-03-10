import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  // Security check for Vercel Cron
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // 1. Identify events that ended yesterday
    // Using UTC date and comparing only the date part
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    console.log(`[Event Monitor] Checking for events that ended on ${yesterdayStr}`);

    const { data: events, error: eventsErr } = await supabase
      .from('tuition_events')
      .select('id, event_name, end_date, status')
      .eq('end_date', yesterdayStr)
      .eq('status', 'active');

    if (eventsErr) throw eventsErr;

    if (!events || events.length === 0) {
      return NextResponse.json({ message: 'No events ended yesterday.', triggered: 0 });
    }

    const results = [];
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    for (const event of events) {
      // 2. Check if already triggered (deduplication)
      const { data: existingStatus } = await supabase
        .from('event_report_status')
        .select('status')
        .eq('event_id', event.id)
        .single();

      if (existingStatus && (existingStatus.status === 'generated' || existingStatus.status === 'sent')) {
        results.push({ eventId: event.id, status: 'skipped (already generated)' });
        continue;
      }

      // 3. Trigger Generation Pipeline
      // We trigger it asynchronously by calling our own internal API
      const response = await fetch(`${baseUrl}/api/reports/generate/${event.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const resData = await response.json();
      results.push({ eventId: event.id, triggerResult: resData });
    }

    return NextResponse.json({ 
      message: `Processed ${events.length} events.`, 
      results 
    });
  } catch (error: any) {
    console.error('[Event Monitor] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
