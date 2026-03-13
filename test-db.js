const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://pdhyxbzexccpxdmbmlzu.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkaHl4YnpleGNjcHhkbWJtbHp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDEzNTA0OSwiZXhwIjoyMDg1NzExMDQ5fQ.sZ-450waC1F2krLt0Xgql21itI0XxEdbWCRgRczo6j8');

async function test() {
  console.log('Testing student_classes...');
  const { data: d1, error: e1 } = await supabase.from('student_classes').select('*').limit(1);
  console.log('student_classes:', e1 ? e1.message : 'exists');

  console.log('Testing assignment_recipients...');
  const { data: d2, error: e2 } = await supabase.from('assignment_recipients').select('*').limit(1);
  console.log('assignment_recipients:', e2 ? e2.message : 'exists');

  console.log('Testing assignment publishing logic...');
  const { data: d3, error: e3 } = await supabase.from('assignments').select('id, title, class_id, status').eq('status', 'PUBLISHED').limit(2);
  console.log('assignments (published):', e3 ? e3.message : d3);
  
  // also get a student ID
  const { data: std } = await supabase.from('profiles').select('id').eq('role', 'student').limit(1);
  if (std && std.length > 0) {
     const stId = std[0].id;
     console.log('Testing assignment query for student:', stId);
     const { data: classRows } = await supabase.from('student_classes').select('class_id').eq('student_id', stId);
     const classIds = classRows ? classRows.map(c => c.class_id) : [];
     console.log('Student class IDs:', classIds);
     
     if (classIds.length > 0) {
        const { data: pubAssign } = await supabase.from('assignments').select('*').eq('status', 'PUBLISHED').in('class_id', classIds);
        console.log('Assignments via Class:', pubAssign ? pubAssign.length : 0);
     }
  }
}
test();
