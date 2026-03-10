import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
  const { data: prof } = await supabase.from('profiles').select('id, full_name, subjects').ilike('full_name', 'Mojo').single();
  const { data: enrolls } = await supabase.from('student_classes').select('class_id').eq('student_id', prof.id);
  const classId = enrolls[0].class_id;
  
  const { data: sessions } = await supabase.from('timetable_sessions').select('subject').eq('class_id', classId);
  const sessionSubjects = [...new Set(sessions.map(s => s.subject))];
  
  console.log(`Student Mojo subjects:`, prof.subjects);
  console.log(`Class Sessions subjects:`, sessionSubjects);
  
  const matches = sessionSubjects.filter(s => prof.subjects.includes(s));
  console.log(`Matches according to case-sensitive RLS:`, matches);
  
  if (matches.length === sessionSubjects.length) {
    console.log('SUCCESS: All sessions should be visible to student.');
  } else {
    console.log('PARTIAL/FAILURE: Some sessions might still be hidden.');
  }
}

verify().catch(console.error).finally(() => process.exit(0));
