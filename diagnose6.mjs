import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEnrollments() {
  const { data: cls } = await supabase.from('classes').select('*').ilike('name', 'form 3').single();
  console.log('Class:', cls.name, cls.id);
  
  const { data: rawEnrollments, error } = await supabase.from('student_classes').select('*').eq('class_id', cls.id);
  console.log('Raw Enrollments for Form 3:', rawEnrollments);
  if (error) console.error(error);
  
  const { data: specificStudent } = await supabase.from('profiles').select('id, full_name, subjects').ilike('full_name', '%mojo%').single();
  console.log('Check student:', specificStudent);
}

checkEnrollments().catch(console.error);
