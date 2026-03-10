import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function diagnoseV8() {
  const form3ClassId = '9d510f4f-32e3-472e-9a64-111a43fe7059';
  
  console.log('--- Checking Timetable Sessions for Form 3 ---');
  const { data: sessions } = await supabase.from('timetable_sessions').select('*').eq('class_id', form3ClassId);
  console.log(`Found ${sessions?.length || 0} sessions.`);
  if (sessions && sessions.length > 0) {
    console.log('Sample Session:', JSON.stringify(sessions[0], null, 2));
    const statuses = [...new Set(sessions.map(s => s.status))];
    console.log('Session Statuses:', statuses);
    const subjects = [...new Set(sessions.map(s => s.subject))];
    console.log('Session Subjects:', subjects);
  }

  console.log('\n--- Comparing Misa vs Mojo ---');
  const { data: profiles } = await supabase.from('profiles').select('id, full_name, subjects, profile_completed').in('full_name', ['misa', 'Mojo']);
  console.log('Profiles:', JSON.stringify(profiles, null, 2));

  for (const prof of (profiles || [])) {
    console.log(`\nChecking student_subjects for ${prof.full_name} (${prof.id}):`);
    const { data: subTable } = await supabase.from('student_subjects').select('*').eq('student_id', prof.id);
    console.log(JSON.stringify(subTable, null, 2));
    
    console.log(`Checking student_classes for ${prof.full_name}:`);
    const { data: enrolls } = await supabase.from('student_classes').select('*').eq('student_id', prof.id);
    console.log(JSON.stringify(enrolls, null, 2));
  }

  console.log('\n--- Checking RLS Logic - Simulation ---');
  // Re-checking the RLS policy logic manually
  // Policy: (status IN ('published', 'locked')) AND (exists in student_classes) AND (subject match OR no subject enrollment)
  
  if (sessions && sessions.length > 0) {
    const session = sessions[0];
    const mojo = profiles.find(p => p.full_name === 'Mojo');
    const { data: mojoSubs } = await supabase.from('student_subjects').select('subject_name').eq('student_id', mojo.id);
    
    const hasPublished = ['published', 'locked'].includes(session.status);
    const enrolled = true; // confirmed in deep_out.txt
    
    const noSubsEnrollment = mojoSubs.length === 0;
    const subMatch = mojoSubs.some(ms => ms.subject_name === session.subject);
    const profileMatch = mojo.subjects?.includes(session.subject);

    console.log(`Simulating RLS for Mojo on Session ${session.id} (${session.subject}):`);
    console.log(`- Status OK? ${hasPublished} (Status: ${session.status})`);
    console.log(`- Enrolled? ${enrolled}`);
    console.log(`- No Sub Enrollment? ${noSubsEnrollment}`);
    console.log(`- Subject Match (Table)? ${subMatch}`);
    console.log(`- Subject Match (Profile)? ${profileMatch}`);
    console.log(`- FINAL RLS PASS? ${hasPublished && enrolled && (noSubsEnrollment || subMatch || profileMatch)}`);
  }
}

diagnoseV8().catch(console.error).finally(() => process.exit(0));
