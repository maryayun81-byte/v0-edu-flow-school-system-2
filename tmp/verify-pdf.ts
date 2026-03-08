import { generateFinancialReportPDF } from '../lib/reports/ReportPDFGenerator';
import * as fs from 'fs';
import * as path from 'path';

const dummyReport: any = {
  event: {
    id: 'test-event-id',
    name: 'Verification Tuition Event',
    start_date: '2026-03-01',
    end_date: '2026-03-07',
    expected_revenue: 50000,
  },
  metrics: {
    total_expected: 50000,
    total_collected: 42500,
    outstanding_balance: 7500,
    collection_efficiency: 0.85,
    payment_completion_rate: 0.8,
    students_paid: 8,
    students_pending: 2,
    total_students: 10,
    peak_payment_day: '2026-03-05',
  },
  payment_methods: [
    { method: 'mpesa', total: 30000, count: 6, percentage: 70.5 },
    { method: 'cash', total: 12500, count: 2, percentage: 29.5 },
  ],
  student_records: Array.from({ length: 10 }, (_, i) => ({
    student_id: `s-${i}`,
    student_name: `Student ${i + 1}`,
    admission_number: `A00${i}`,
    amount_paid: i < 8 ? 5000 : 0,
    amount_outstanding: i < 8 ? 0 : 5000,
    status: i < 8 ? 'paid' : 'pending',
    last_payment_date: '2026-03-05'
  })),
  transactions: [],
  generated_at: new Date().toISOString(),
};

async function testGeneration() {
  console.log('--- Starting PDF Generation Test ---');
  try {
    const doc = generateFinancialReportPDF(dummyReport);
    const buffer = Buffer.from(doc.output('arraybuffer'));
    
    const outputPath = path.join(process.cwd(), 'tmp', 'test_financial_report.pdf');
    if (!fs.existsSync(path.join(process.cwd(), 'tmp'))) {
      fs.mkdirSync(path.join(process.cwd(), 'tmp'));
    }
    
    fs.writeFileSync(outputPath, buffer);
    console.log(`✅ PDF generated successfully: ${outputPath}`);
    console.log(`   Buffer size: ${(buffer.length / 1024).toFixed(2)} KB`);
  } catch (err) {
    console.error('❌ PDF generation failed:', err);
  }
}

testGeneration();
