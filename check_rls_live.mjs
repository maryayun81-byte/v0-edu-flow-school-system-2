import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkPolicies() {
  console.log('--- Current RLS Policies for timetable_sessions ---');
  const { data, error } = await supabase.rpc('get_table_policies', { table_name_input: 'timetable_sessions' });
  
  if (error) {
    // Fallback: try raw query via rpc if we have one, otherwise we might need to use a different approach
    // Since I can't easily add RPCs, I'll try to find an existing one or just use what I have.
    console.error('Error fetching policies via RPC:', error);
    
    // Attempt to query pg_policies via a generic query if possible, 
    // but usually rpc is needed for system tables.
    // I'll try to use the 'check_timetable_conflicts' as a proxy if I can't get policies.
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
  
  console.log('\n--- Checking if student_subjects table exists and has rows ---');
  const { count: subCount } = await supabase.from('student_subjects').select('*', { count: 'exact', head: true });
  console.log('student_subjects row count:', subCount);

  console.log('\n--- Checking if is_admin function exists ---');
  const { data: adminCheck, error: adminErr } = await supabase.rpc('is_admin');
  console.log('is_admin() call success?', !adminErr);
}

// Since I might not have an RPC for policies, I'll try to verify the BRITTLE policy manually.
// Brittle policy: JOIN classes c ON c.name = p.form_class
// mojo.form_class = 'Form 3'
// class.name = 'form 3'

checkPolicies().catch(console.error).finally(() => process.exit(0));
