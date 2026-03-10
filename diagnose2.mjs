import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  console.log("1. Fetching all classes...");
  const { data: classes } = await supabase.from('classes').select('id, name');
  console.log(classes);

  console.log("\n2. Fetching all timetable sessions...");
  const { data: sessions, error } = await supabase.from('timetable_sessions').select('*');
  if (error) console.log(error);
  console.log(`Found ${sessions?.length || 0} sessions.`);
  
  if (sessions && sessions.length > 0) {
    console.log("Sample session:", sessions[0]);
    // group by class
    const byClass = {};
    sessions.forEach(s => {
      byClass[s.class_id] = (byClass[s.class_id] || 0) + 1;
    });
    console.log("Sessions per class:", byClass);
  }

  console.log("\n3. Fetching student classes (Form 3)...");
  const { data: profiles } = await supabase.from('profiles').select('id, full_name, form_class').ilike('form_class', 'form%');
  const profileIds = profiles.map(p => p.id);
  
  const { data: enrollments } = await supabase.from('student_classes').select('*').in('student_id', profileIds);
  
  const studentMap = {};
  profiles.forEach(p => studentMap[p.id] = p);
  
  enrollments.forEach(e => {
    const p = studentMap[e.student_id];
    console.log(`Student ${p.full_name} (${p.form_class}) -> Enrolled in class: ${e.class_id}`);
  });
}

run().catch(console.error);
