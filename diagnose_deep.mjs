import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function deepDiagnose() {
  console.log('--- Checking Classes ---');
  const { data: allClasses } = await supabase.from('classes').select('*');
  console.log('All Classes:', JSON.stringify(allClasses, null, 2));

  console.log('\n--- Checking Sessions Count per Class ---');
  const { data: counts } = await supabase.rpc('get_sessions_count_per_class'); // if exists, else manual loop
  if (!counts) {
    for (const cls of (allClasses || [])) {
      const { count } = await supabase.from('timetable_sessions').select('*', { count: 'exact', head: true }).eq('class_id', cls.id);
      console.log(`Class ${cls.name} (${cls.id}): ${count} sessions`);
    }
  }

  console.log('\n--- Checking Latest Student Enrollments ---');
  const { data: profiles } = await supabase.from('profiles').select('id, full_name, form_class').order('created_at', { ascending: false }).limit(5);
  for (const p of (profiles || [])) {
    const { data: enrolls } = await supabase.from('student_classes').select('class_id').eq('student_id', p.id);
    console.log(`Student ${p.full_name} (${p.id}) enrolled in class IDs:`, enrolls?.map(e => e.class_id));
  }

  console.log('\n--- Checking RLS for timetable_sessions (via policy query if possible) ---');
  // We can't query pg_policies easily without raw SQL access, but we can check if ANON sees sessions.
  const anonSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: anonSessions } = await anonSupabase.from('timetable_sessions').select('*').limit(1);
  console.log('Anon key can see sessions?', !!anonSessions && anonSessions.length > 0);
}

deepDiagnose().catch(console.error).finally(() => process.exit(0));
