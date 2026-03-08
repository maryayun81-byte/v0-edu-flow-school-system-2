import { Resend } from 'resend';
import twilio from 'twilio';
import type { FinancialReportData } from './FinancialDataAggregator';

const resend = new Resend(process.env.RESEND_API_KEY);
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function sendFinancialReportEmail(
  pdfBuffer: Buffer,
  csvString: string,
  report: FinancialReportData,
  recipientEmail: string
) {
  const eventName = report.event.name;
  const date = new Date().toLocaleDateString('en-KE', { dateStyle: 'long' });

  try {
    const { data, error } = await resend.emails.send({
      from: 'Peak Performance Reports <reports@resend.dev>', // Should ideally be a verified domain
      to: [recipientEmail],
      subject: `Tuition Event Financial Report – ${eventName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #334155;">
          <h1 style="color: #6366f1;">Financial Report Ready</h1>
          <p>The financial report for the completed tuition event <strong>${eventName}</strong> has been generated successfully.</p>
          
          <div style="background-color: #f1f5f9; padding: 20px; border-radius: 12px; margin: 20px 0;">
            <h2 style="font-size: 16px; margin-top: 0;">Executive Summary Snapshot</h2>
            <ul style="list-style: none; padding: 0;">
              <li style="margin-bottom: 8px;">💰 <strong>Expected:</strong> KSh ${report.metrics.total_expected.toLocaleString()}</li>
              <li style="margin-bottom: 8px;">✅ <strong>Collected:</strong> KSh ${report.metrics.total_collected.toLocaleString()}</li>
              <li style="margin-bottom: 8px;">📉 <strong>Outstanding:</strong> KSh ${report.metrics.outstanding_balance.toLocaleString()}</li>
              <li style="margin-bottom: 8px;">📊 <strong>Efficiency:</strong> ${(report.metrics.collection_efficiency * 100).toFixed(1)}%</li>
            </ul>
          </div>

          <p>Please find the executive PDF report and raw CSV data attached for your review.</p>
          
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
          <p style="font-size: 12px; color: #64748b;">This is an automated report from the Peak Performance Financial Intelligence Engine.</p>
        </div>
      `,
      attachments: [
        {
          filename: `Financial_Report_${eventName.replace(/\s+/g, '_')}.pdf`,
          content: pdfBuffer,
        },
        {
          filename: `Financial_Data_${eventName.replace(/\s+/g, '_')}.csv`,
          content: Buffer.from(csvString),
        },
      ],
    });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error sending financial report email:', err);
    throw err;
  }
}

export async function sendFinancialReportWhatsApp(
  report: FinancialReportData,
  recipientPhone: string
) {
  const message = `🚀 *Peak Performance Financial Intelligence*

Your tuition event financial report for *${report.event.name}* has been generated successfully.

📊 *Key Metrics:*
• Collection Efficiency: *${(report.metrics.collection_efficiency * 100).toFixed(1)}%*
• Total Collected: *KSh ${report.metrics.total_collected.toLocaleString()}*
• Outstanding: *KSh ${report.metrics.outstanding_balance.toLocaleString()}*
• Payment Completion: *${(report.metrics.payment_completion_rate * 100).toFixed(1)}%*

The detailed report has been sent to your email: ${process.env.ADMIN_EMAIL}.

Check the Reports Archive in the Admin Dashboard for downloads.`;

  try {
    const result = await twilioClient.messages.create({
      from: 'whatsapp:+14155238886', // Twilio sandbox number
      to: `whatsapp:${recipientPhone}`,
      body: message,
    });
    return result;
  } catch (err) {
    console.error('Error sending financial report WhatsApp:', err);
    throw err;
  }
}
