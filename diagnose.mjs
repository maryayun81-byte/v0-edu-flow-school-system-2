import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pdhyxbzexccpxdmbmlzu.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkaHl4YnpleGNjcHhkbWJtbHp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMzUwNDksImV4cCI6MjA4NTcxMTA0OX0.UdJN9cC_Lhf3mAyOHn93q60x3CHU6By0v8psCFzQW8E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  const { data: cls } = await supabase.from('classes').select('id, name');
  console.log('All Classes:', cls);
  
  const { data: sessions } = await supabase.from('timetable_sessions')
      .select('id, class_id, subject, day_of_week')
      .in('status', ['published', 'locked']);
    
  console.log('Total published/locked sessions:', sessions?.length);
  
  // Group sessions by class_id
  const sessionCounts = {};
  for (const s of (sessions || [])) {
    sessionCounts[s.class_id] = (sessionCounts[s.class_id] || 0) + 1;
  }
  console.log('Sessions by class_id:', sessionCounts);
}

diagnose().catch(console.error);
