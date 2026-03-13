const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://pdhyxbzexccpxdmbmlzu.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkaHl4YnpleGNjcHhkbWJtbHp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDEzNTA0OSwiZXhwIjoyMDg1NzExMDQ5fQ.sZ-450waC1F2krLt0Xgql21itI0XxEdbWCRgRczo6j8');

async function check() {
  const { data, error } = await supabase.rpc('query_sql', {
    sql: "SELECT policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'student_classes'"
  });
  if (error) {
    console.log("RPC query_sql might not exist. Let's try direct query through REST if possible, or just psql");
    // Fallback if rpc doesn't exist: I can just write a script to run a psql command or use another known RPC.
  } else {
    console.log(data);
  }
}
check();
