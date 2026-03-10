import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEnrollments() {
  const { data: latestUsers, error } = await supabase.from('profiles').select('id, full_name, form_class').order('created_at', { ascending: false }).limit(5);
  console.log('Latest profiles:', latestUsers);
  for (const u of (latestUsers || [])) {
    const { data: enrolls } = await supabase.from('student_classes').select('class_id').eq('student_id', u.id);
    console.log(`Enrollments for ${u.full_name}:`, enrolls);
    if (enrolls && enrolls.length > 0) {
      const { data: sessions } = await supabase.from('timetable_sessions').select('id, subject, day_of_week').eq('class_id', enrolls[0].class_id);
      console.log(`Sessions count for class ${enrolls[0].class_id}:`, sessions?.length);
    }
  }
}

checkEnrollments().catch(console.error).finally(() => process.exit(0));
