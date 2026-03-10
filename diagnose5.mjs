import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkContent() {
  const { data: cls } = await supabase.from('classes').select('*').ilike('name', 'form 3').single();
  console.log('Class:', cls.name, cls.id);
  
  const { data: assignments } = await supabase.from('assignments').select('*').eq('class_id', cls.id).eq('status', 'PUBLISHED');
  console.log('Published Assignments for Form 3:', assignments?.length);
  
  const { data: notes } = await supabase.from('notes').select('*').eq('class_id', cls.id);
  console.log('Notes for Form 3:', notes?.length);
  
  // also check how many students are enrolled in this class
  const { data: enrolls } = await supabase.from('student_classes').select(`
    student_id,
    profiles(full_name, form_class)
  `).eq('class_id', cls.id);
  
  console.log('\nEnrolled Students:', JSON.stringify(enrolls, null, 2));
}

checkContent().catch(console.error);
