import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role key bypasses RLS
const supabase = createClient(supabaseUrl, supabaseKey);
async function run() {
  const { data: cls } = await supabase.from('classes').select('*').ilike('name', 'form 3').single();
  console.log('Class:', cls);
  const { data: sessions, error } = await supabase.from('timetable_sessions').select('*').eq('class_id', cls.id);
  console.log('Sessions for Form 3:', sessions);
  if (error) console.error(error);
}
run();
