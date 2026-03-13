import jsPDF from 'jspdf';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

interface AssignmentReportData {
  student: {
    name: string;
    admission_number?: string;
    class?: string;
  };
  assignment: {
    title: string;
    total_marks: number;
    subject?: string;
  };
  submission: {
    submitted_at: string;
    score: number;
    teacher_remarks?: string;
    strengths: string[];
    weaknesses: string[];
    improvements: string[];
  };
  questions: Array<{
    id: string;
    order_index: number;
    question_text: string;
    marks: number;
    marks_obtained: number;
    student_answer?: string;
    teacher_comment?: string;
  }>;
}

export async function generateAssignmentPDFReport(submissionId: string): Promise<void> {
  // 1. Fetch Complete Submission Data
  const { data: sub, error: subErr } = await supabase
    .from('student_submissions')
    .select(`
      *,
      assignment:assignments(
        *,
        subjects(name),
        classes(name)
      ),
      student:profiles!student_submissions_student_id_fkey(
        full_name,
        admission_number,
        form_class
      ),
      answers:student_question_answers(*),
      markings:question_markings(*)
    `)
    .eq('id', submissionId)
    .single() as any;

  if (subErr || !sub) throw new Error('Submission not found');

  // 2. Fetch Questions
  const { data: questions, error: qErr } = await supabase
    .from('assignment_questions')
    .select('*')
    .eq('assignment_id', sub.assignment_id)
    .order('order_index', { ascending: true });

  if (qErr) throw qErr;

  // 3. Map Data
  const answerMap = new Map(sub.answers?.map((a: any) => [a.question_id, a]));
  const markingMap = new Map(sub.markings?.map((m: any) => [m.question_id, m]));

  const reportData: AssignmentReportData = {
    student: {
      name: sub.student?.full_name || 'Unknown Student',
      admission_number: sub.student?.admission_number,
      class: sub.student?.form_class
    },
    assignment: {
      title: sub.assignment.title,
      total_marks: sub.assignment.total_marks,
      subject: sub.assignment.subjects?.name
    },
    submission: {
      submitted_at: sub.submitted_at,
      score: sub.score || 0,
      teacher_remarks: sub.teacher_remarks,
      strengths: sub.strengths || [],
      weaknesses: sub.weaknesses || [],
      improvements: sub.improvement_suggestions || []
    },
    questions: questions.map((q: any) => ({
      id: q.id,
      order_index: q.order_index,
      question_text: q.question_text,
      marks: q.marks,
      marks_obtained: (markingMap.get(q.id) as any)?.marks_awarded || 0,
      student_answer: (answerMap.get(q.id) as any)?.answer_text,
      teacher_comment: (markingMap.get(q.id) as any)?.teacher_comment
    }))
  };

  await createPDF(reportData);
}

async function createPDF(data: AssignmentReportData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;

  // Design Tokens
  const primary = [79, 70, 229]; // Indigo-600
  const stealth = [15, 23, 42]; // Slate-900
  const emerald = [16, 185, 129];
  const rose = [244, 63, 94];

  const checkNewPage = (h: number) => {
    if (yPos + h > pageHeight - 20) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  // Header
  doc.setFillColor(stealth[0], stealth[1], stealth[2]);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('ACADEMIC PERFORMANCE REPORT', 20, 20);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.text('SYSTEM GENERATED ENTERPRISE EVALUATION', 20, 30);
  
  doc.setTextColor(255, 255, 255);
  doc.text(`${data.assignment.title.toUpperCase()}`, pageWidth - 20, 20, { align: 'right' });
  doc.text(new Date(data.submission.submitted_at).toLocaleDateString(), pageWidth - 20, 30, { align: 'right' });

  yPos = 60;

  // Info Grid
  doc.setTextColor(stealth[0], stealth[1], stealth[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('STUDENT IDENTIFICATION', 20, yPos);
  
  doc.setFont('helvetica', 'normal');
  doc.text(`NAME: ${data.student.name}`, 20, yPos + 10);
  doc.text(`CLASS: ${data.student.class || 'N/A'}`, 20, yPos + 17);
  doc.text(`ADMISSION: ${data.student.admission_number || 'N/A'}`, 20, yPos + 24);

  doc.setFont('helvetica', 'bold');
  doc.text('EVALUATION PARAMETERS', pageWidth / 2, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(`SUBJECT: ${data.assignment.subject || 'N/A'}`, pageWidth / 2, yPos + 10);
  doc.text(`TOTAL MARKS: ${data.assignment.total_marks}`, pageWidth / 2, yPos + 17);
  doc.text(`SYSTEM ID: ${Math.random().toString(36).substr(2, 8).toUpperCase()}`, pageWidth / 2, yPos + 24);

  yPos += 45;

  // Score Summary Box
  const percentage = Math.round((data.submission.score / data.assignment.total_marks) * 100);
  doc.setDrawColor(primary[0], primary[1], primary[2]);
  doc.setLineWidth(1);
  doc.roundedRect(20, yPos, pageWidth - 40, 35, 3, 3);
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('OVERALL SCORE', pageWidth / 2, yPos + 12, { align: 'center' });
  
  doc.setFontSize(28);
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.text(`${data.submission.score} / ${data.assignment.total_marks}`, pageWidth / 2, yPos + 26, { align: 'center' });
  
  yPos += 55;

  // Structured Feedback
  if (data.submission.strengths.length > 0 || data.submission.weaknesses.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(stealth[0], stealth[1], stealth[2]);
    doc.text('STRATEGIC FEEDBACK', 20, yPos);
    yPos += 10;

    const boxWidth = (pageWidth - 50) / 2;
    
    // Strengths
    doc.setFillColor(240, 253, 244);
    doc.rect(20, yPos, boxWidth, 40, 'F');
    doc.setTextColor(6, 95, 70);
    doc.setFontSize(8);
    doc.text('COGNITIVE STRENGTHS', 25, yPos + 8);
    doc.setFontSize(7);
    data.submission.strengths.slice(0, 4).forEach((s, i) => {
        doc.text(`• ${s}`, 25, yPos + 15 + (i * 6));
    });

    // Weaknesses
    doc.setFillColor(254, 242, 242);
    doc.rect(20 + boxWidth + 10, yPos, boxWidth, 40, 'F');
    doc.setTextColor(153, 27, 27);
    doc.setFontSize(8);
    doc.text('PERFORMANCE GAPS', 25 + boxWidth + 10, yPos + 8);
    doc.setFontSize(7);
    data.submission.weaknesses.slice(0, 4).forEach((w, i) => {
        doc.text(`• ${w}`, 25 + boxWidth + 10, yPos + 15 + (i * 6));
    });

    yPos += 55;
  }

  // Teacher Summary
  if (data.submission.teacher_remarks) {
    checkNewPage(40);
    doc.setTextColor(stealth[0], stealth[1], stealth[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('EXECUTIVE SUMMARY', 20, yPos);
    yPos += 8;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    const remarks = doc.splitTextToSize(data.submission.teacher_remarks, pageWidth - 40);
    doc.text(remarks, 20, yPos);
    yPos += (remarks.length * 5) + 15;
  }

  // Detailed Question Analysis
  checkNewPage(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('DETAILED ITEM ANALYSIS', 20, yPos);
  yPos += 12;

  data.questions.forEach((q, idx) => {
    checkNewPage(40);
    
    doc.setFillColor(248, 250, 252);
    doc.rect(20, yPos, pageWidth - 40, 35, 'F');
    
    doc.setFontSize(9);
    doc.setTextColor(stealth[0], stealth[1], stealth[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(`Q${idx + 1}: ${q.question_text.substring(0, 80)}...`, 25, yPos + 8);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Student Answer: ${q.student_answer || 'No response'}`, 25, yPos + 15, { maxWidth: pageWidth - 80 });
    
    doc.setTextColor(primary[0], primary[1], primary[2]);
    doc.text(`Score: ${q.marks_obtained} / ${q.marks}`, pageWidth - 25, yPos + 15, { align: 'right' });
    
    if (q.teacher_comment) {
        doc.setTextColor(primary[0], primary[1], primary[2]);
        doc.setFont('helvetica', 'italic');
        doc.text(`Teacher Note: ${q.teacher_comment}`, 25, yPos + 28, { maxWidth: pageWidth - 60 });
    }
    
    yPos += 45;
  });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text('CONFIDENTIAL ACADEMIC RECORD', 20, pageHeight - 10);
  }

  const fileName = `AssignmentReport_${data.student.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  doc.save(fileName);
}
