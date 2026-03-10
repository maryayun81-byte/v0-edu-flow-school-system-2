import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testRealInsert() {
  const { data: profile } = await supabase.from('profiles').select('id').limit(1).single();
  
  if (!profile) {
    console.error('No profiles found to test with.');
    process.exit(1);
  }

  console.log('Testing insert with real user ID:', profile.id);

  const { error } = await supabase
    .from('notifications')
    .insert({
      title: 'Activity Logged',
      message: 'You completed a test activity.',
      type: 'activity',
      audience: 'individual',
      target_user_id: profile.id
    });

  if (error) {
    console.error('Insert failed:', error.message);
  } else {
    console.log('RESULT: Success! "activity" type is fully allowed.');
    // Clean up
    await supabase.from('notifications').delete().eq('title', 'Activity Logged');
  }
}

testRealInsert().catch(console.error);
