import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkColumns() {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching notifications:', error);
  } else if (data && data.length > 0) {
    console.log('Columns in notifications:', Object.keys(data[0]));
  } else {
    // If no data, try to fetch from information_schema via a trick
    // (If we have an RPC for it)
    console.log('No data in notifications table to infer columns.');
  }
}

checkColumns().catch(console.error);
