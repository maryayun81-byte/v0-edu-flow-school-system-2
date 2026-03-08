
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function diagnose() {
  const { data, error } = await supabase.from('information_schema.tables').select('table_name').eq('table_schema', 'public');
  if (error) {
      // If we can't access info schema, let's try a direct select and catch error
      try {
          const { error: directError } = await supabase.from('user_roles').select('*').limit(1);
          console.log('Direct select user_roles error:', directError);
      } catch (e) {
          console.log('Direct select user_roles threw exception');
      }
  } else {
      console.log('Public tables:', data.map(t => t.table_name));
  }
}

diagnose();
