
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function diagnose() {
  console.log('--- Starting Diagnostic ---');

  // 1. Check Classes
  const { data: classes } = await supabase.from('classes').select('id, name');
  console.log('Available Classes in DB:', classes);

  // 2. Check Student Profiles
  const { data: students } = await supabase.from('profiles').select('id, full_name, form_class').eq('role', 'student');
  console.log('Student Profiles:', students);

  // 3. Check for mismatches
  if (students && classes) {
    students.forEach(student => {
      const match = classes.find(c => c.name === student.form_class);
      if (match) {
        console.log(`[MATCH] Student ${student.full_name} (${student.form_class}) correctly matches Class ID ${match.id}`);
      } else {
        console.log(`[MISMATCH] Student ${student.full_name} (${student.form_class}) NO MATCH FOUND in classes table!`);
      }
    });
  }

  // 4. Check if student_classes is being used
  const { data: studentClasses } = await supabase.from('student_classes').select('id, student_id, class_id');
  console.log('StudentEnrollments (student_classes table):', studentClasses);

  // 5. Check Notifications for target_class_id
  const { data: notifCols } = await supabase.rpc('get_column_info', { p_table_name: 'notifications' });
  // If RPC doesn't exist, we'll try a simple select
  try {
      const { data: notifSample } = await supabase.from('notifications').select('*').limit(1);
      if (notifSample && notifSample.length > 0) {
          console.log('Notification Sample Columns:', Object.keys(notifSample[0]));
      }
  } catch (e) {
      console.log('Could not fetch notifications sample');
  }

  console.log('--- Diagnostic Complete ---');
}

diagnose();
