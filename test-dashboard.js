const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://pdhyxbzexccpxdmbmlzu.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkaHl4YnpleGNjcHhkbWJtbHp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDEzNTA0OSwiZXhwIjoyMDg1NzExMDQ5fQ.sZ-450waC1F2krLt0Xgql21itI0XxEdbWCRgRczo6j8');

async function test() {
  const studentId = '5a432477-d052-4ed8-a4c6-94387e9eb2a7';

  // 1. Get assignments from recipients table (targeted delivery)
  const { data: recipientRows } = await supabase
    .from('assignment_recipients')
    .select('assignment_id')
    .eq('student_id', studentId);

  const recipientIds = recipientRows?.map((r) => r.assignment_id) || [];
  console.log('Recipient IDs:', recipientIds);

  // 2. Also get class-wide assignments
  const { data: classRows } = await supabase
    .from('student_classes')
    .select('class_id')
    .eq('student_id', studentId);
  const classIds = classRows?.map((c) => c.class_id) || [];
  console.log('Class IDs (from student_classes):', classIds);

  const { data: enrolls } = await supabase
    .from('student_subject_enrollments')
    .select('class_id')
    .eq('student_id', studentId);
  console.log('Class IDs (from student_subject_enrollments):', enrolls?.map(e => e.class_id));

  // 3. The Query
  let query = supabase
    .from('assignments')
    .select(`
      id,
      title,
      status,
      classes(name),
      subjects(name)
    `)
    .eq('status', 'PUBLISHED')
    .order('due_date', { ascending: true });

  if (recipientIds.length > 0 && classIds.length > 0) {
    query = query.or(`id.in.(${recipientIds.join(',')}),class_id.in.(${classIds.join(',')})`);
  } else if (recipientIds.length > 0) {
    query = query.in('id', recipientIds);
  } else if (classIds.length > 0) {
    query = query.in('class_id', classIds);
  }

  const { data: rawAssignments, error } = await query;
  console.log('Raw Assignments Error:', error);
  console.log('Raw Assignments:', rawAssignments);
}
test();
