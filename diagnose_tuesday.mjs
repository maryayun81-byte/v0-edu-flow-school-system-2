import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function diagnoseTuesday() {
  const form3Id = '9d510f4f-32e3-472e-9a64-111a43fe7059';
  console.log('--- Tuesday Sessions for Form 3 (Admin View) ---');
  const { data: sessions } = await supabase.from('timetable_sessions')
    .select('*')
    .eq('class_id', form3Id)
    .eq('day_of_week', 'Tuesday')
    .eq('status', 'published');
  
  console.log(JSON.stringify(sessions, null, 2));

  console.log('\n--- Checking for Students with "Form 3" vs "form 3" mismatches ---');
  const { data: allForm3Profiles } = await supabase.from('profiles').select('id, full_name, form_class').ilike('form_class', 'form 3');
  console.log('All Form 3 Profiles:', allForm3Profiles.length);
  
  for (const p of allForm3Profiles) {
    const { data: en } = await supabase.from('student_classes').select('*').eq('student_id', p.id).eq('class_id', form3Id);
    if (!en || en.length === 0) {
      console.log(`Student ${p.full_name} (${p.id}) has form_class=${p.form_class} but NO enrollment in class_id ${form3Id}`);
    }
  }

  console.log('\n--- Final Check on Subject Strings (Hex Dump) ---');
  if (sessions && sessions.length > 0) {
    const sub = sessions[0].subject;
    console.log(`Session Subject: "${sub}" (Length: ${sub.length})`);
    console.log('Hex:', Buffer.from(sub).toString('hex'));
  }
  
  const { data: mojo } = await supabase.from('profiles').select('subjects').ilike('full_name', 'Mojo').single();
  if (mojo && mojo.subjects && mojo.subjects.length > 0) {
    const sub = mojo.subjects[0]; // Mathematics
    console.log(`Mojo Subject[0]: "${sub}" (Length: ${sub.length})`);
    console.log('Hex:', Buffer.from(sub).toString('hex'));
  }
}

diagnoseTuesday().catch(console.error).finally(() => process.exit(0));
