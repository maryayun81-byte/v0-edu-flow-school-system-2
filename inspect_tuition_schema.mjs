import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectSchema() {
  console.log('--- Inspecting tuition_events ---');
  const { data: events, error: eErr } = await supabase.from('tuition_events').select('*').limit(1);
  if (eErr) console.error('tuition_events error:', eErr.message);
  else if (events && events.length > 0) console.log('tuition_events columns:', Object.keys(events[0]));
  else console.log('tuition_events table is empty or doesn\'t exist.');

  console.log('\n--- Inspecting profiles ---');
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*').limit(1);
  if (pErr) console.error('profiles error:', pErr.message);
  else if (profiles && profiles.length > 0) console.log('profiles columns:', Object.keys(profiles[0]));

  console.log('\n--- Checking for existing registrations table ---');
  const { error: rErr } = await supabase.from('event_registrations').select('*').limit(1);
  if (rErr) console.log('event_registrations doesn\'t exist (expected).');
  else console.log('event_registrations already exists.');
}

inspectSchema().catch(console.error);
