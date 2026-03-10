import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SUBJECT_MAP = {
  'math': 'Mathematics',
  'eng': 'English',
  'kis': 'Kiswahili',
  'kiswahili': 'Kiswahili',
  'phy': 'Physics',
  'chem': 'Chemistry',
  'bio': 'Biology',
  'hist': 'History',
  'geo': 'Geography',
  'cs': 'Computer Studies',
  'bus': 'Business Studies',
  'agri': 'Agriculture',
  're': 'Religious Education'
};

async function syncSubjects() {
  console.log('--- Syncing Timetable Sessions ---');
  const { data: sessions } = await supabase.from('timetable_sessions').select('id, subject');
  
  for (const s of (sessions || [])) {
    const mapped = SUBJECT_MAP[s.subject.toLowerCase()];
    if (mapped && mapped !== s.subject) {
      console.log(`Updating session ${s.id}: ${s.subject} -> ${mapped}`);
      await supabase.from('timetable_sessions').update({ subject: mapped }).eq('id', s.id);
    }
  }

  console.log('\n--- Syncing Student Subjects Table ---');
  const { data: studentSubs } = await supabase.from('student_subjects').select('student_id, subject_name');
  for (const ss of (studentSubs || [])) {
    const mapped = SUBJECT_MAP[ss.subject_name.toLowerCase()];
    if (mapped && mapped !== ss.subject_name) {
      console.log(`Updating student_subject for ${ss.student_id}: ${ss.subject_name} -> ${mapped}`);
      await supabase.from('student_subjects').update({ subject_name: mapped }).match({ student_id: ss.student_id, subject_name: ss.subject_name });
    }
  }
  
  console.log('\nDone.');
}

syncSubjects().catch(console.error).finally(() => process.exit(0));
