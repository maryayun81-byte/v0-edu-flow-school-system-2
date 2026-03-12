import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pdhyxbzexccpxdmbmlzu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkaHl4YnpleGNjcHhkbWJtbHp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDEzNTA0OSwiZXhwIjoyMDg1NzExMDQ5fQ.sZ-450waC1F2krLt0Xgql21itI0XxEdbWCRgRczo6j8'
);

async function run() {
  const { data: ev } = await supabase.from('tuition_events').select('*').eq('status', 'active');
  const event = ev[0];
  if (!event) return console.log('No active event');

  const { data: attendance } = await supabase.from('attendance').select('*').eq('event_id', event.id);
  
  const studentMap = {};
  attendance.forEach(a => {
    if (!studentMap[a.student_id]) {
      studentMap[a.student_id] = {
        event_id: event.id,
        student_id: a.student_id,
        class_id: a.class_id,
        days_present: 0,
        days_late: 0,
        days_absent: 0,
        days_excused: 0
      };
    }
    
    // update class id to latest
    studentMap[a.student_id].class_id = a.class_id;
    
    if (a.status === 'present') studentMap[a.student_id].days_present++;
    if (a.status === 'late') studentMap[a.student_id].days_late++;
    if (a.status === 'absent') studentMap[a.student_id].days_absent++;
    if (a.status === 'excused') studentMap[a.student_id].days_excused++;
  });

  const records = Object.values(studentMap).map(s => {
    const total_eval_days = event.attendance_eval_days;
    const adjusted_eval_days = Math.max(0, total_eval_days - s.days_excused);
    
    let attendance_percentage = 0;
    if (adjusted_eval_days > 0) {
       attendance_percentage = Math.round(((s.days_present + s.days_late) / adjusted_eval_days) * 10000) / 100;
       attendance_percentage = Math.min(100, attendance_percentage);
    }
    
    const is_eligible = (attendance_percentage >= event.attendance_threshold) && 
                       ((s.days_present + s.days_late + s.days_absent) >= event.attendance_eval_days);
                       
    return {
      event_id: s.event_id,
      student_id: s.student_id,
      class_id: s.class_id,
      days_present: s.days_present,
      days_late: s.days_late,
      days_absent: s.days_absent,
      days_excused: s.days_excused,
      total_eval_days,
      adjusted_eval_days,
      attendance_percentage,
      is_eligible,
      threshold_used: event.attendance_threshold,
      calculated_at: new Date().toISOString()
    };
  });

  console.log(`Upserting ${records.length} eligibility records...`);
  const { error } = await supabase.from('exam_eligibility').upsert(records, { onConflict: 'event_id, student_id' });
  if (error) console.error('Upsert error:', error);
  else console.log('Successfully upserted!');
  
}

run();
