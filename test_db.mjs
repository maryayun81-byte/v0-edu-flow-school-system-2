import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pdhyxbzexccpxdmbmlzu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkaHl4YnpleGNjcHhkbWJtbHp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDEzNTA0OSwiZXhwIjoyMDg1NzExMDQ5fQ.sZ-450waC1F2krLt0Xgql21itI0XxEdbWCRgRczo6j8'
);

async function run() {
  const {data: ev} = await supabase.from('tuition_events').select('id').eq('status', 'active');
  const activeId = ev[0]?.id;
  console.log('Active event:', activeId);
  const {error} = await supabase.rpc('fn_mass_recalculate_eligibility', { p_event_id: activeId });
  console.log('RPC error:', error);
  const {data: e} = await supabase.from('exam_eligibility').select('class_id, classes(name)');
  const classCounts = {};
  e?.forEach(r => {
    const name = r.classes?.name || 'Unknown';
    classCounts[name] = (classCounts[name] || 0) + 1;
  });
  console.log('New Eligibility class distribution:', classCounts);
}

run();
