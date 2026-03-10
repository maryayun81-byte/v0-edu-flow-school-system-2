import { NextRequest, NextResponse } from 'next/server';
import { CognitiveCore, DashboardContext, InsightDomain } from '@/lib/ai/CognitiveCore';
import { createClient } from '@/lib/supabase/server';

/**
 * Central Intelligence API
 * GET /api/intelligence/insights?entity_type=student&entity_id=<id>&context=<student|teacher|admin|finance>&domains=attendance,academic
 *
 * All dashboards must consume this endpoint.
 * Never scatter insight generation logic inside dashboard components.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    const entityType  = searchParams.get('entity_type') as 'student' | 'platform' ?? 'student';
    const entityId    = searchParams.get('entity_id') ?? 'anonymous';
    const context     = (searchParams.get('context') as DashboardContext) ?? 'student';
    const rawDomains  = searchParams.get('domains');
    const domains     = rawDomains
      ? (rawDomains.split(',') as InsightDomain[])
      : (['attendance', 'academic', 'success'] as InsightDomain[]);

    // Admin / Finance contexts → platform-wide insights
    if (entityType === 'platform') {
      const supabase = await createClient();
      const { data: platformInsights } = await supabase
        .from('intelligence_insights')
        .select('insight_text, insight_type, confidence, created_at')
        .eq('entity_type', 'platform')
        .order('created_at', { ascending: false })
        .limit(6);

      if (platformInsights && platformInsights.length > 0) {
        return NextResponse.json({
          source: 'cache',
          insights: platformInsights.map((r: any) => ({
            insight_text: r.insight_text,
            type: r.insight_type,
            confidence: r.confidence,
          })),
        });
      }
    }

    // Student / Teacher contexts → per-student insights
    const insights = await CognitiveCore.getInsightsForDashboard(entityId, context, domains);

    return NextResponse.json({
      source: 'generated',
      entity_type: entityType,
      entity_id: entityId,
      context,
      insights,
    });

  } catch (err) {
    console.error('[Intelligence API] Error:', err);
    return NextResponse.json(
      { error: 'Intelligence core unavailable. Please retry.' },
      { status: 500 }
    );
  }
}
