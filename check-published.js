const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://pdhyxbzexccpxdmbmlzu.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkaHl4YnpleGNjcHhkbWJtbHp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDEzNTA0OSwiZXhwIjoyMDg1NzExMDQ5fQ.sZ-450waC1F2krLt0Xgql21itI0XxEdbWCRgRczo6j8');

async function checkAssignments() {
  console.log("--- fetch PUBLISHED recent assignments ---");
  const { data: recent, error: rErr } = await supabase
    .from('assignments')
    .select('*')
    .eq('status', 'PUBLISHED')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (rErr) console.error(rErr);
  else console.log(JSON.stringify(recent, null, 2));

  console.log("--- fetch all recent assignments including from yesterday ---");
  const { data: all, error: aErr } = await supabase
    .from('assignments')
    .select('id, title, status, is_published, created_at, class_id, subject_id, subject')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (aErr) console.error(aErr);
  else console.log(JSON.stringify(all, null, 2));
}

checkAssignments();
