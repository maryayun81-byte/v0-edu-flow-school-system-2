const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://pdhyxbzexccpxdmbmlzu.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkaHl4YnpleGNjcHhkbWJtbHp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDEzNTA0OSwiZXhwIjoyMDg1NzExMDQ5fQ.sZ-450waC1F2krLt0Xgql21itI0XxEdbWCRgRczo6j8');

async function checkAssignments() {
  console.log("--- fetch recent assignments ---");
  const { data: recent, error: rErr } = await supabase
    .from('assignments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (rErr) console.error(rErr);
  else console.log(JSON.stringify(recent, null, 2));

  console.log("--- fetch older assignments (e.g., from yesterday) to compare ---");
  const { data: older, error: oErr } = await supabase
    .from('assignments')
    .select('*')
    .order('created_at', { ascending: false })
    .range(5, 10);
    
  if (oErr) console.error(oErr);
  else console.log(JSON.stringify(older, null, 2));
}

checkAssignments();
