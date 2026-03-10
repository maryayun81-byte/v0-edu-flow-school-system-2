import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testInsert() {
  const { error } = await supabase
    .from('notifications')
    .insert({
      title: 'Test Type',
      message: 'Testing if activity type is allowed',
      type: 'activity',
      audience: 'individual',
      target_user_id: '00000000-0000-0000-0000-000000000000' // dummy uuid just for check
    });

  if (error) {
    console.error('Insert failed:', error.message);
    if (error.message.includes('check constraint')) {
      console.log('RESULT: Constraint still exists and blocks "activity" type.');
    }
  } else {
    console.log('RESULT: Success! "activity" type is allowed.');
    // Clean up
    await supabase.from('notifications').delete().eq('title', 'Test Type');
  }
}

testInsert().catch(console.error);
