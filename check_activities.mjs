import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkActivities() {
  console.log('--- Checking for activities table ---');
  const { data, error } = await supabase.from('activities').select('*').limit(1);
  if (error) {
    if (error.code === '42P01') {
      console.log('Table "activities" does not exist.');
    } else {
      console.error('Error checking activities:', error);
    }
  } else {
    console.log('Table "activities" exists.');
  }
}

checkActivities().catch(console.error).finally(() => process.exit(0));
