import { createClient } from '@supabase/supabase-js';

// Uses service role for server-side aggregation
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface StudentPaymentRecord {
  student_id: string;
  student_name: string;
  admission_number: string;
  amount_paid: number;
  amount_outstanding: number;
  payment_method: string;
  status: string;
  last_payment_date: string | null;
}

export interface PaymentMethodBreakdown {
  method: string;
  total: number;
  count: number;
  percentage: number;
}

export interface FinancialReportData {
  event: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    expected_revenue: number;
  };
  metrics: {
    total_expected: number;
    total_collected: number;
    outstanding_balance: number;
    collection_efficiency: number;          // 0–1
    payment_completion_rate: number;        // 0–1
    students_paid: number;
    students_pending: number;
    total_students: number;
    peak_payment_day: string | null;
  };
  payment_methods: PaymentMethodBreakdown[];
  student_records: StudentPaymentRecord[];
  transactions: Array<{
    id: string;
    student_id: string;
    amount: number;
    payment_method: string;
    status: string;
    timestamp: string;
  }>;
  created_at: string;
}

export async function aggregateEventFinancials(eventId: string): Promise<FinancialReportData> {
  // 1. Fetch tuition event
  const { data: event, error: eventError } = await supabase
    .from('tuition_events')
    .select('id, event_name, start_date, end_date, expected_revenue, tuition_fee')
    .eq('id', eventId)
    .single();

  if (eventError || !event) throw new Error(`Event not found: ${eventId}`);

  // 2. Fetch all payments for this event (supports both ppt_payments and finance_transactions)
  const { data: payments } = await supabase
    .from('ppt_payments')
    .select(`
      id, student_id, amount, payment_method, status, payment_date,
      profiles!inner(full_name, admission_number),
      tuition_events(event_name, tuition_fee)
    `)
    .eq('event_id', eventId);

  const { data: transactions } = await supabase
    .from('finance_transactions')
    .select('id, student_id, amount, payment_method, status, timestamp')
    .eq('event_id', eventId);

  const allPayments = payments || [];

  // 3. Compute metrics
  const totalExpected = event.expected_revenue || event.tuition_fee || 0;
  const totalCollected = allPayments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const outstanding = Math.max(0, totalExpected - totalCollected);
  const collectionEff = totalExpected > 0 ? totalCollected / totalExpected : 0;

  // Group by student to find paid vs pending
  const studentMap = new Map<string, StudentPaymentRecord>();
  for (const p of allPayments) {
    const profile = (p as any).profiles;
    const sid = p.student_id;
    if (!studentMap.has(sid)) {
      studentMap.set(sid, {
        student_id: sid,
        student_name: profile?.full_name || 'Unknown',
        admission_number: profile?.admission_number || '—',
        amount_paid: 0,
        amount_outstanding: totalExpected / Math.max(1, allPayments.length),
        payment_method: p.payment_method || 'unknown',
        status: p.status,
        last_payment_date: p.payment_date,
      });
    }
    const rec = studentMap.get(sid)!;
    if (p.status === 'paid') rec.amount_paid += p.amount;
    rec.last_payment_date = p.payment_date;
  }

  const studentRecords = Array.from(studentMap.values()).map(r => ({
    ...r,
    amount_outstanding: Math.max(0, (event.tuition_fee || 0) - r.amount_paid),
    status: r.amount_paid >= (event.tuition_fee || 0) ? 'paid'
      : r.amount_paid > 0 ? 'partial'
      : 'pending',
  }));

  const studentsPaid = studentRecords.filter(r => r.status === 'paid').length;
  const studentsPending = studentRecords.filter(r => r.status !== 'paid').length;
  const totalStudents = studentRecords.length;

  // Payment method breakdown
  const methodMap = new Map<string, { total: number; count: number }>();
  for (const p of allPayments.filter(p => p.status === 'paid')) {
    const m = (p.payment_method || 'other').toLowerCase();
    const cur = methodMap.get(m) || { total: 0, count: 0 };
    cur.total += p.amount;
    cur.count += 1;
    methodMap.set(m, cur);
  }

  const paymentMethods: PaymentMethodBreakdown[] = Array.from(methodMap.entries()).map(([method, data]) => ({
    method,
    total: data.total,
    count: data.count,
    percentage: totalCollected > 0 ? (data.total / totalCollected) * 100 : 0,
  }));

  // Peak payment day
  const dayCount = new Map<string, number>();
  for (const p of allPayments) {
    const day = p.payment_date ? p.payment_date.slice(0, 10) : null;
    if (day) dayCount.set(day, (dayCount.get(day) || 0) + 1);
  }
  const peakDay = [...dayCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return {
    event: {
      id: event.id,
      name: event.event_name,
      start_date: event.start_date,
      end_date: event.end_date,
      expected_revenue: totalExpected,
    },
    metrics: {
      total_expected: totalExpected,
      total_collected: totalCollected,
      outstanding_balance: outstanding,
      collection_efficiency: collectionEff,
      payment_completion_rate: totalStudents > 0 ? studentsPaid / totalStudents : 0,
      students_paid: studentsPaid,
      students_pending: studentsPending,
      total_students: totalStudents,
      peak_payment_day: peakDay,
    },
    payment_methods: paymentMethods,
    student_records: studentRecords,
    transactions: (transactions || []).map(t => ({
      id: t.id,
      student_id: t.student_id,
      amount: t.amount,
      payment_method: t.payment_method,
      status: t.status,
      timestamp: t.timestamp,
    })),
    created_at: new Date().toISOString(),
  };
}
