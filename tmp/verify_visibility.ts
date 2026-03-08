
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function verify() {
  console.log('--- Starting Verification ---');

  // 1. Check for student_classes enrollments
  const { data: enrollments, error: scError } = await supabase.from('student_classes').select('student_id, class_id').limit(5);
  if (scError) console.error('Error fetching student_classes:', scError.message);
  else console.log('Sample Enrollments:', enrollments);

  // 2. Check for assignments with class_id
  const { data: assignments, error: aError } = await supabase.from('assignments').select('id, title, class_id').eq('status', 'PUBLISHED').limit(5);
  if (aError) console.error('Error fetching assignments:', aError.message);
  else console.log('Sample Published Assignments:', assignments);

  // 3. Test Join Logic (Conceptual check)
  if (enrollments && enrollments.length > 0 && assignments && assignments.length > 0) {
      const studentId = enrollments[0].student_id;
      const classId = enrollments[0].class_id;
      
      console.log(`Testing visibility for student ${studentId} in class ${classId}`);
      
      const { data: visible, error: vError } = await supabase
        .from('assignments')
        .select('id, title')
        .eq('class_id', classId)
        .eq('status', 'PUBLISHED');
        
      if (vError) console.error('Visibility check failed:', vError.message);
      else console.log(`Student ${studentId} can see ${visible?.length || 0} assignments for their class.`);
  } else {
      console.log('Not enough data to perform visibility check. Please ensure student_classes and published assignments exist.');
  }

  // 4. Check Notifications for target_class_id
  const { data: notifSample, error: nError } = await supabase.from('notifications').select('id, title, target_class_id').not('target_class_id', 'is', null).limit(5);
  if (nError) console.error('Error fetching notifications:', nError.message);
  else console.log('Notifications with target_class_id:', notifSample);

  console.log('--- Verification Complete ---');
}

verify();
