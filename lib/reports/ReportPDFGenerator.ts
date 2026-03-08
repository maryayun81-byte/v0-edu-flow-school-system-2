import jsPDF from 'jspdf';
import type { FinancialReportData } from './FinancialDataAggregator';

const COLORS = {
  primary: [99, 102, 241] as [number, number, number],       // Indigo
  success: [16, 185, 129] as [number, number, number],       // Emerald
  warning: [245, 158, 11] as [number, number, number],       // Amber
  danger: [239, 68, 68] as [number, number, number],          // Red
  dark: [15, 23, 42] as [number, number, number],             // Slate-900
  mid: [71, 85, 105] as [number, number, number],             // Slate-600
  light: [241, 245, 249] as [number, number, number],         // Slate-100
  white: [255, 255, 255] as [number, number, number],
  accent: [139, 92, 246] as [number, number, number],         // Violet
};

const PAGE_W = 210;  // A4 mm
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;

export function generateFinancialReportPDF(report: FinancialReportData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = 0;

  function newPage() {
    doc.addPage();
    y = MARGIN;
  }

  function checkPageBreak(height: number) {
    if (y + height > PAGE_H - MARGIN) newPage();
  }

  function fmt(n: number) {
    return `KSh ${n.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
  }

  function pct(n: number) {
    return `${(n * 100).toFixed(1)}%`;
  }

  // ──────────────────────────────────────────────────────────
  // COVER / HEADER
  // ──────────────────────────────────────────────────────────
  // Dark header band
  doc.setFillColor(...COLORS.dark);
  doc.rect(0, 0, PAGE_W, 58, 'F');

  // Accent bar
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 58, PAGE_W, 3, 'F');

  // Platform name
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('PEAK PERFORMANCE TUTORING', MARGIN, 18);

  // Report title
  doc.setFontSize(22);
  doc.text('FINANCIAL REPORT', MARGIN, 32);

  // Event name
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(180, 190, 210);
  doc.text(report.event.name, MARGIN, 42);

  // Right side metadata
  const now = new Date(report.created_at);
  doc.setFontSize(8);
  doc.setTextColor(150, 160, 180);
  const meta = [
    `Generated: ${now.toLocaleDateString('en-KE', { dateStyle: 'medium' })}`,
    `Period: ${new Date(report.event.start_date).toLocaleDateString('en-KE', { dateStyle: 'medium' })} — ${new Date(report.event.end_date).toLocaleDateString('en-KE', { dateStyle: 'medium' })}`,
    `Event ID: ${report.event.id.slice(0, 8).toUpperCase()}`,
  ];
  let mx = PAGE_W - MARGIN;
  meta.forEach((line, i) => {
    doc.text(line, mx, 18 + i * 8, { align: 'right' });
  });

  y = 72;

  // ──────────────────────────────────────────────────────────
  // EXECUTIVE SUMMARY
  // ──────────────────────────────────────────────────────────
  const eff = report.metrics.collection_efficiency;
  const effLabel = eff >= 0.9 ? 'strong' : eff >= 0.7 ? 'moderate' : 'low';
  const peakStr = report.metrics.peak_payment_day
    ? `with peak activity on ${new Date(report.metrics.peak_payment_day).toLocaleDateString('en-KE', { dateStyle: 'medium' })}`
    : 'throughout the event period';

  const summary =
    `During the ${report.event.name} event, payment activity was ${effLabel} ${peakStr}. ` +
    `Collection efficiency reached ${pct(eff)}, with ${fmt(report.metrics.total_collected)} recovered ` +
    `of the ${fmt(report.metrics.total_expected)} expected revenue. ` +
    `${report.metrics.students_paid} of ${report.metrics.total_students} enrolled students ` +
    `completed their payments, while ${report.metrics.students_pending} account(s) carry outstanding balances.`;

  doc.setFillColor(...COLORS.light);
  doc.roundedRect(MARGIN, y, CONTENT_W, 28, 3, 3, 'F');

  doc.setTextColor(...COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('EXECUTIVE SUMMARY', MARGIN + 5, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.mid);
  const summaryLines = doc.splitTextToSize(summary, CONTENT_W - 10);
  doc.text(summaryLines, MARGIN + 5, y + 14);
  y += 36;

  // ──────────────────────────────────────────────────────────
  // KEY METRICS — 3 columns
  // ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.dark);
  doc.text('FINANCIAL METRICS', MARGIN, y + 6);
  y += 10;

  const metrics = [
    { label: 'Total Expected', value: fmt(report.metrics.total_expected), color: COLORS.mid },
    { label: 'Total Collected', value: fmt(report.metrics.total_collected), color: COLORS.success },
    { label: 'Outstanding Balance', value: fmt(report.metrics.outstanding_balance), color: COLORS.warning },
    { label: 'Collection Efficiency', value: pct(report.metrics.collection_efficiency), color: COLORS.primary },
    { label: 'Payment Completion', value: pct(report.metrics.payment_completion_rate), color: COLORS.accent },
    { label: 'Students Enrolled', value: report.metrics.total_students.toString(), color: COLORS.mid },
  ];

  const colW = CONTENT_W / 3;
  metrics.forEach((m, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = MARGIN + col * colW;
    const cy = y + row * 22;

    doc.setFillColor(...COLORS.white);
    doc.setDrawColor(220, 225, 235);
    doc.roundedRect(cx, cy, colW - 3, 19, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...m.color);
    doc.text(m.value, cx + (colW - 3) / 2, cy + 10, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.mid);
    doc.text(m.label, cx + (colW - 3) / 2, cy + 16, { align: 'center' });
  });
  y += 48;

  // ──────────────────────────────────────────────────────────
  // PAYMENT METHOD BREAKDOWN
  // ──────────────────────────────────────────────────────────
  if (report.payment_methods.length > 0) {
    checkPageBreak(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.dark);
    doc.text('PAYMENT METHOD DISTRIBUTION', MARGIN, y + 6);
    y += 12;

    const barColors: [number, number, number][] = [COLORS.primary, COLORS.success, COLORS.accent, COLORS.warning];
    report.payment_methods.forEach((m, i) => {
      checkPageBreak(8);
      const barMaxW = CONTENT_W - 60;
      const barW = Math.max(2, (m.percentage / 100) * barMaxW);
      const color = barColors[i % barColors.length];

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...COLORS.mid);
      doc.text(m.method.toUpperCase(), MARGIN, y + 4);

      doc.setFillColor(220, 225, 230);
      doc.roundedRect(MARGIN + 35, y - 1, barMaxW, 6, 3, 3, 'F');

      doc.setFillColor(...color);
      doc.roundedRect(MARGIN + 35, y - 1, barW, 6, 3, 3, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.dark);
      doc.text(`${fmt(m.total)} (${m.percentage.toFixed(1)}%)`, MARGIN + 35 + barMaxW + 3, y + 4);

      y += 9;
    });
    y += 4;
  }

  // ──────────────────────────────────────────────────────────
  // STUDENT PAYMENT STATUS TABLE
  // ──────────────────────────────────────────────────────────
  checkPageBreak(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.dark);
  doc.text('STUDENT PAYMENT STATUS', MARGIN, y + 6);
  y += 10;

  // Table header
  doc.setFillColor(...COLORS.dark);
  doc.rect(MARGIN, y, CONTENT_W, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.white);
  const cols = [MARGIN + 2, MARGIN + 55, MARGIN + 100, MARGIN + 135, MARGIN + 160];
  doc.text('STUDENT NAME', cols[0], y + 5.5);
  doc.text('ADM. NO', cols[1], y + 5.5);
  doc.text('AMOUNT PAID', cols[2], y + 5.5);
  doc.text('OUTSTANDING', cols[3], y + 5.5);
  doc.text('STATUS', cols[4], y + 5.5);
  y += 9;

  const statusColors: Record<string, [number, number, number]> = {
    paid: COLORS.success,
    partial: COLORS.warning,
    pending: COLORS.danger,
  };

  report.student_records.slice(0, 50).forEach((s, idx) => {
    checkPageBreak(7);
    if (idx % 2 === 0) {
      doc.setFillColor(...COLORS.light);
      doc.rect(MARGIN, y - 1, CONTENT_W, 7, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.dark);
    doc.text(s.student_name.length > 25 ? s.student_name.slice(0, 22) + '…' : s.student_name, cols[0], y + 4.5);
    doc.text(s.admission_number, cols[1], y + 4.5);
    doc.text(fmt(s.amount_paid), cols[2], y + 4.5);
    doc.text(fmt(s.amount_outstanding), cols[3], y + 4.5);

    const sColor = statusColors[s.status] || COLORS.mid;
    doc.setTextColor(...sColor);
    doc.setFont('helvetica', 'bold');
    doc.text(s.status.toUpperCase(), cols[4], y + 4.5);
    y += 7;
  });

  if (report.student_records.length > 50) {
    y += 3;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.mid);
    doc.text(`… and ${report.student_records.length - 50} more students. See CSV export for full list.`, MARGIN, y);
    y += 8;
  }

  // ──────────────────────────────────────────────────────────
  // FOOTER (on every page)
  // ──────────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(230, 232, 240);
    doc.rect(0, PAGE_H - 10, PAGE_W, 10, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.mid);
    doc.text('CONFIDENTIAL — Peak Performance Tutoring Financial Intelligence', MARGIN, PAGE_H - 4);
    doc.text(`Page ${p} of ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 4, { align: 'right' });
  }

  return doc;
}

export function generateCSV(report: FinancialReportData): string {
  const header = ['transaction_id', 'student_id', 'amount', 'payment_method', 'status', 'timestamp'];
  const rows = report.transactions.map(t => [
    t.id, t.student_id, t.amount.toString(), t.payment_method, t.status, t.timestamp,
  ]);
  return [header, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}
