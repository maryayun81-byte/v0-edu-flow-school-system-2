import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkExisting() {
  const { data: cls } = await supabase.from('classes').select('*').ilike('name', 'form 3').single();
  
  // Find students in this class who were created more than a week ago
  const { data: enrolls } = await supabase.from('student_classes').select('student_id').eq('class_id', cls.id).limit(10);
  const ids = enrolls?.map(e => e.student_id) || [];
  
  const { data: profiles } = await supabase.from('profiles').select('id, full_name, subjects, created_at').in('id', ids);
  console.log('Form 3 Students:', JSON.stringify(profiles, null, 2));
}

checkExisting().catch(console.error).finally(() => process.exit(0));
